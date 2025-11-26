import { useState } from "react";
import * as monaco from "monaco-editor";
import type { Issue } from "../../../src/shared/analyzer/types";
import type { EditSnippet, PreviewMode, PreviewState } from "../types";

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

type MonacoEdit = { range: monaco.Range; text: string };

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

  const [pendingAiEdits, setPendingAiEdits] = useState<MonacoEdit[]>([]);

  // open preview for a single TS issue
  function openPreviewForIssue(issue: Issue, issueEdits: MonacoEdit[]) {
    const snippets = buildSnippetsFromEdits(issueEdits);
    if (!snippets.length) return;
    setPreview({
      visible: true,
      mode: "issue",
      issue,
      snippets,
    });
    setPendingAiEdits([]);
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
    if (preview.mode !== "ai") return;
    setPreview((prev) => ({
      ...prev,
      snippets: prev.snippets.map((sn, i) =>
        i === index ? { ...sn, selected: !sn.selected } : sn
      ),
    }));
  }

  function applyPreview(selectedIndices?: number[]) {
    if (preview.mode === "issue" && preview.issue) {
      // issue mode: all-or-nothing
      // actual edits are built outside and passed in when calling openPreviewForIssue
      // so here we just signal "apply"; actual apply is done by caller or we can
      // choose to not use selectedIndices at all for issue mode.
      closePreview();
      return;
    }

    if (preview.mode === "ai" && pendingAiEdits.length) {
      const indicesToApply =
        selectedIndices && selectedIndices.length
          ? selectedIndices
          : pendingAiEdits.map((_, idx) => idx);

      if (!indicesToApply.length) {
        closePreview();
        return;
      }

      const editsToApply = indicesToApply.map((idx) => pendingAiEdits[idx]);
      applyEditsWithReveal(editsToApply, "a11y-ai-preview-apply");
      closePreview();
      return;
    }

    closePreview();
  }

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
