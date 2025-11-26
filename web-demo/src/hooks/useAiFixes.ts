import { useState } from "react";
import * as monaco from "monaco-editor";
import type { Issue } from "../../../src/shared/analyzer/types";
import type { EditSnippet, PreviewMode } from "../types";

type MonacoEdit = { range: monaco.Range; text: string };

type PreviewState = {
  visible: boolean;
  mode: PreviewMode;
  issue: Issue | null;
  snippets: EditSnippet[];
};

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

type BackendPosition = { line: number; column: number };
type BackendEdit = {
  start: BackendPosition;
  end: BackendPosition;
  newText: string;
};
type GenerateResponse = { edits?: BackendEdit[] };

export function useAiFixes(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  applyEditsWithReveal: (edits: MonacoEdit[], source: string) => void,
  buildSnippetsFromEdits: (edits: MonacoEdit[]) => EditSnippet[]
) {
  const [preview, setPreview] = useState<PreviewState>({
    visible: false,
    mode: null,
    issue: null,
    snippets: [],
  });

  // All edits returned from backend (flat list)
  const [pendingAiEdits, setPendingAiEdits] = useState<MonacoEdit[]>([]);

  // ---------- Preview control for TS issue mode ----------

  function openPreviewForIssue(issue: Issue, issueEdits: MonacoEdit[]) {
    const snippets = buildSnippetsFromEdits(issueEdits);
    if (!snippets.length) return;

    setPreview({
      visible: true,
      mode: "issue",
      issue,
      snippets,
    });
    setPendingAiEdits([]); // TS issue mode doesn't use AI edits
  }

  function closePreview() {
    setPreview({
      visible: false,
      mode: null,
      issue: null,
      snippets: [],
    });
    setPendingAiEdits([]);
  }

  function toggleSnippet(index: number) {
    setPreview((prev) => ({
      ...prev,
      snippets: prev.snippets.map((sn, i) =>
        i === index ? { ...sn, selected: !sn.selected } : sn
      ),
    }));
  }

  // ---------- Apply button logic ----------

  function applyPreview(selectedIndices?: number[]) {
    // 1) TS issue mode – all-or-nothing, caller handles actual edits
    if (preview.mode === "issue" && preview.issue) {
      // we just close; App uses handleFixIssue(issue) if needed
      closePreview();
      return;
    }

    // 2) AI mode – apply only edits corresponding to selected snippets
    if (preview.mode === "ai" && pendingAiEdits.length) {
      // Which snippets are "selected"?
      const activeSnippetIndexes = new Set<number>(
        selectedIndices && selectedIndices.length
          ? selectedIndices
          : (preview.snippets
              .map((sn, i) => (sn.selected === false ? null : i))
              .filter((v) => v !== null) as number[])
      );

      if (!activeSnippetIndexes.size) {
        closePreview();
        return;
      }

      // Collect all line numbers for those snippets
      const linesToApply = new Set<number>();

      preview.snippets.forEach((sn, i) => {
        if (!activeSnippetIndexes.has(i)) return;

        // We encode line info in locationLabel, e.g. "Line 3" or "Lines 3-5"
        const matches = [...sn.locationLabel.matchAll(/\d+/g)];
        matches.forEach((m) => {
          const num = parseInt(m[0], 10);
          if (!Number.isNaN(num)) linesToApply.add(num);
        });
      });

      if (!linesToApply.size) {
        closePreview();
        return;
      }

      // Pick ONLY the backend edits whose start line is in linesToApply
      const editsToApply = pendingAiEdits.filter((ed) =>
        linesToApply.has(ed.range.startLineNumber)
      );

      if (!editsToApply.length) {
        closePreview();
        return;
      }

      applyEditsWithReveal(editsToApply, "a11y-ai-preview-apply");
      closePreview();
      return;
    }

    // Fallback
    closePreview();
  }

  // ---------- Call backend /generate ----------

  async function generateAiFixes() {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editor.getValue(),
          mode: "heuristic",
        }),
      });

      if (!res.ok) {
        console.error("Backend /generate failed:", res.status, res.statusText);
        return;
      }

      const data: GenerateResponse = await res.json();

      if (data?.edits?.length) {
        const monacoEdits: MonacoEdit[] = data.edits.map((ed) => {
          const range = new monaco.Range(
            ed.start.line + 1,
            ed.start.column + 1,
            ed.end.line + 1,
            ed.end.column + 1
          );
          return { range, text: ed.newText };
        });

        const snippets = buildSnippetsFromEdits(monacoEdits);

        if (!snippets.length) {
          // nothing to preview – just apply everything
          applyEditsWithReveal(
            monacoEdits,
            "a11y-generate-placeholders-nopreview"
          );
          return;
        }

        setPendingAiEdits(monacoEdits);
        setPreview({
          visible: true,
          mode: "ai",
          issue: null,
          snippets,
        });
      }
    } catch (err) {
      console.error("generate placeholder failed", err);
    }
  }

  return {
    preview,
    openPreviewForIssue,
    closePreview,
    toggleSnippet,
    applyPreview,
    generateAiFixes,
  };
}
