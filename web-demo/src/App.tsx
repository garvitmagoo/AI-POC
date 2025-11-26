import React, { useEffect } from "react";
import * as monaco from "monaco-editor";

import { useMonacoEditor } from "./hooks/useMonacoEditor";
import { useIssues } from "./hooks/useIssues";
import { useAiFixes } from "./hooks/useAiFixes";
import type { EditSnippet } from "./types";

import EditorPanel from "./components/EditorPanel";
import IssuesPanel from "./components/IssuesPanel";
import PreviewModal from "./components/PreviewModal";

const appRootStyle: React.CSSProperties = {
  display: "flex",
  height: "100vh",
};

const editorColumnStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

export default function App() {
  // Monaco editor wiring
  const { editorRef, containerRef, applyEditsWithReveal, revealPosition } =
    useMonacoEditor();

  // Local TS analyzer issues
  const { issues, runAnalysis, buildEditsFromIssue } = useIssues(editorRef);

  // Run analysis initially + on every editor change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // initial run
    runAnalysis(editor.getValue());

    // subscribe to changes
    const sub = editor.onDidChangeModelContent(() => {
      runAnalysis(editor.getValue());
    });

    return () => sub.dispose();
  }, [editorRef, runAnalysis]);

  // ---------- Build preview snippets from AI / issue edits ----------

  type MonacoEdit = { range: monaco.Range; text: string };

  function buildSnippetsFromEdits(
    edits: { range: monaco.Range; text: string }[]
  ): EditSnippet[] {
    const editor = editorRef.current;
    if (!editor || !edits.length) return [];

    const model = editor.getModel();
    if (!model) return [];

    // Group edits by the line they start on.
    // (All our backend rules generate single-line edits.)
    const groups = new Map<
      number,
      { edits: { range: monaco.Range; text: string }[] }
    >();

    for (const e of edits) {
      const line = e.range.startLineNumber;
      const group = groups.get(line) || { edits: [] };
      group.edits.push(e);
      groups.set(line, group);
    }

    const snippets: EditSnippet[] = [];

    for (const [lineNumber, group] of groups.entries()) {
      const originalLine = model.getLineContent(lineNumber);
      let afterLine = originalLine;

      // Apply all edits for this line from right to left so indices stay valid
      const sorted = [...group.edits].sort(
        (a, b) => a.range.startColumn - b.range.startColumn
      );

      for (const e of [...sorted].reverse()) {
        const startAbs = model.getOffsetAt(e.range.getStartPosition());
        const endAbs = model.getOffsetAt(e.range.getEndPosition());

        const lineStartAbs = model.getOffsetAt(
          new monaco.Position(lineNumber, 1)
        );

        const relStart = startAbs - lineStartAbs;
        const relEnd = endAbs - lineStartAbs;

        afterLine =
          afterLine.slice(0, relStart) + e.text + afterLine.slice(relEnd);
      }

      snippets.push({
        before: originalLine,
        after: afterLine,
        locationLabel: `Line ${lineNumber}`,
        selected: true,
      });
    }

    // Show in document order
    return snippets.sort((a, b) => {
      const getLine = (label: string) => {
        const m = label.match(/Line\s+(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      return getLine(a.locationLabel) - getLine(b.locationLabel);
    });
  }

  // ---------- AI fixes hook (Python backend) ----------

  const {
    preview,
    openPreviewForIssue,
    closePreview,
    toggleSnippet,
    applyPreview,
    generateAiFixes,
  } = useAiFixes(editorRef, applyEditsWithReveal, buildSnippetsFromEdits);

  // ---------- Issue actions for the sidebar ----------

  function handleFixIssue(issue: any) {
    const edits = buildEditsFromIssue(issue);
    applyEditsWithReveal(edits, "a11y-fix-issue");
  }

  function handleJumpIssue(issue: any) {
    const line = issue.start.line + 1;
    const col = issue.start.column + 1;
    revealPosition(line, col);
  }

  function handlePreviewIssue(issue: any) {
    const edits = buildEditsFromIssue(issue);
    openPreviewForIssue(issue, edits);
  }

  // ---------- Render ----------

  return (
    <div className="app-root" style={appRootStyle}>
      <div style={editorColumnStyle}>
        <EditorPanel containerRef={containerRef} />
      </div>

      {/* Right sidebar – styled via .a11y-panel in index.css */}
      <aside className="a11y-panel">
        <IssuesPanel
          issues={issues}
          onFixIssue={handleFixIssue}
          onJumpIssue={handleJumpIssue}
          onPreviewIssue={handlePreviewIssue}
          handleGeneratePlaceholders={generateAiFixes}
        />
      </aside>

      <PreviewModal
        issue={preview.issue}
        snippets={preview.snippets}
        visible={preview.visible}
        mode={preview.mode}
        onClose={closePreview}
        onApply={(indices) => applyPreview(indices)}
        onToggleSnippet={toggleSnippet}
      />
    </div>
  );
}
