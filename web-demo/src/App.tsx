import React, { useEffect } from "react";
import * as monaco from "monaco-editor";
import { useMonacoEditor } from "./hooks/useMonacoEditor";
import { useIssues } from "./hooks/useIssues";
import { useAiFixes } from "./hooks/useAiFixes";
import type { EditSnippet } from "./types";
import IssuesPanel from "./components/IssuesPanel";
import PreviewModal from "./components/PreviewModal";
import EditorPanel from "./components/EditorPanel";

const appRootStyle: React.CSSProperties = {
  display: "flex",
  height: "100vh",
};

const editorColumnStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

export default function App() {
  // 🔹 Create editor once
  const { editorRef, containerRef, applyEditsWithReveal, revealPosition } =
    useMonacoEditor();

  // 🔹 A11y issues (TS analyzer)
  const { issues, runAnalysis, buildEditsFromIssue } = useIssues(editorRef);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    runAnalysis(editor.getValue());

    // re-run on every change
    const sub = editor.onDidChangeModelContent(() => {
      runAnalysis(editor.getValue());
    });

    return () => sub.dispose();
  }, [editorRef, runAnalysis]);

  // 🔹 Build preview snippets from Monaco edits
  function buildSnippetsFromEdits(
    edits: { range: monaco.Range; text: string }[]
  ): EditSnippet[] {
    const editor = editorRef.current;
    if (!editor) return [];
    const model = editor.getModel();
    if (!model) return [];

    const all = model.getValue();
    const snippets: EditSnippet[] = [];

    for (const e of edits) {
      const sLine0 = e.range.startLineNumber - 1;
      const eLine0 = e.range.endLineNumber - 1;
      const startContext = Math.max(0, sLine0 - 2);
      const endContext = Math.min(model.getLineCount() - 1, eLine0 + 2);

      const contextStartOffset = model.getOffsetAt(
        new monaco.Position(startContext + 1, 1)
      );
      const contextEndOffset = model.getOffsetAt(
        new monaco.Position(
          endContext + 1,
          model.getLineContent(endContext + 1).length + 1
        )
      );
      const startOffset = model.getOffsetAt(e.range.getStartPosition());
      const endOffset = model.getOffsetAt(e.range.getEndPosition());

      const before = all.slice(contextStartOffset, contextEndOffset);
      const after =
        all.slice(contextStartOffset, startOffset) +
        e.text +
        all.slice(endOffset, contextEndOffset);

      snippets.push({
        before,
        after,
        locationLabel: `Lines ${startContext + 1}-${endContext + 1}`,
        selected: true,
      });
    }

    return snippets;
  }

  // 🔹 AI fixes hook
  const {
    preview,
    openPreviewForIssue,
    closePreview,
    toggleSnippet,
    applyPreview,
    generateAiFixes,
  } = useAiFixes(editorRef, applyEditsWithReveal, buildSnippetsFromEdits);

  // ---------- Issue actions ----------
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

  return (
    <div className="app-root" style={appRootStyle}>
      <div style={editorColumnStyle}>
        <EditorPanel containerRef={containerRef} />
      </div>

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
