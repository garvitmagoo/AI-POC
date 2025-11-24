import React, { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { analyzeCode } from "../../src/shared/analyzer";
import type { Issue } from "../../src/shared/analyzer/types";
import IssuesPanel from "./components/IssuesPanel";
import PreviewModal from "./components/PreviewModal";

export default function App() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const decorationIdsRef = useRef<string[]>([]);

  // preview modal state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIssue, setPreviewIssue] = useState<Issue | null>(null);
  const [previewSnippets, setPreviewSnippets] = useState<
    { before: string; after: string; locationLabel: string }[]
  >([]);

  // store a stable reference to runAnalysis so toolbar can call it
  const runAnalysisRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: `<img src="hero.jpg"/>\n<button></button>`,
      language: "plaintext", // keeps Monaco light; switch to "javascript" if worker configured
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      glyphMargin: true
    });

    editorRef.current = editor;

    // analysis function
    const runAnalysis = () => {
      try {
        const text = editor.getValue();
        const res = analyzeCode(text) || [];
        setIssues(res);
      } catch (err) {
        console.error("analysis error", err);
        setIssues([]);
      }
    };

    // expose for toolbar
    runAnalysisRef.current = runAnalysis;

    // initial run and on-change
    const disp = editor.onDidChangeModelContent(() => runAnalysis());
    runAnalysis();

    // window resize -> layout
    const onResize = () => editor.layout();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      disp.dispose();
      editor.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update decorations whenever issues change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // remove old decorations
    const old = decorationIdsRef.current || [];
    decorationIdsRef.current = [];

    // build new decorations
    const decs: monaco.editor.IModelDeltaDecoration[] = issues.map(issue => {
      const sLine = Math.max(1, issue.start.line + 1);
      const sCol = Math.max(1, issue.start.column + 1);
      const eLine = Math.max(sLine, issue.end.line + 1);
      const eCol = Math.max(sCol, issue.end.column + 1);

      return {
        range: new monaco.Range(sLine, sCol, eLine, eCol),
        options: {
          inlineClassName: "a11y-highlight",
          glyphMarginClassName: "a11y-gutter",
          hoverMessage: { value: `**${issue.id}** — ${issue.message}` }
        }
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(old, decs);
  }, [issues]);

  // Build monaco edits from fixes (same as before)
  function buildMonacoEditsFromFixes(issue: Issue) {
    const edits: Array<{ range: monaco.Range; text: string }> = [];
    if (!issue.fix?.edits?.length) return edits;

    for (const e of issue.fix.edits) {
      const sLine = Math.max(1, e.start.line + 1);
      const sCol = Math.max(1, e.start.column + 1);
      const eLine = Math.max(1, e.end.line + 1);
      const eCol = Math.max(1, e.end.column + 1);
      edits.push({ range: new monaco.Range(sLine, sCol, eLine, eCol), text: e.newText });
    }

    edits.sort((a, b) => {
      if (a.range.startLineNumber !== b.range.startLineNumber) return b.range.startLineNumber - a.range.startLineNumber;
      return b.range.startColumn - a.range.startColumn;
    });

    return edits;
  }

  function applyFixForIssue(issue: Issue) {
    const editor = editorRef.current;
    if (!editor) return;
    const edits = buildMonacoEditsFromFixes(issue);
    if (!edits.length) return;
    const monacoEdits = edits.map(e => ({ range: e.range, text: e.text, forceMoveMarkers: true }));
    editor.executeEdits("a11y-fix-issue", monacoEdits);

    // re-run analysis after small delay
    setTimeout(() => {
      runAnalysisRef.current();
      if (edits[0]) {
        editor.revealRange(edits[0].range, monaco.editor.ScrollType.Smooth);
        editor.setSelection(edits[0].range);
        editor.focus();
      }
    }, 40);
  }

  function handleFixAll() {
    const editor = editorRef.current;
    if (!editor) return;

    const flattened: { range: monaco.Range; text: string }[] = [];
    for (const issue of issues) {
      const edits = buildMonacoEditsFromFixes(issue);
      for (const e of edits) flattened.push(e);
    }
    if (!flattened.length) return;

    flattened.sort((a, b) => {
      if (a.range.startLineNumber !== b.range.startLineNumber) return b.range.startLineNumber - a.range.startLineNumber;
      return b.range.startColumn - a.range.startColumn;
    });

    const monacoEdits = flattened.map(fe => ({ range: fe.range, text: fe.text, forceMoveMarkers: true }));
    editor.executeEdits("a11y-fix-all", monacoEdits);

    setTimeout(() => runAnalysisRef.current(), 40);
  }

  function jumpToIssue(issue: Issue) {
    const editor = editorRef.current;
    if (!editor) return;
    const sLine = Math.max(1, issue.start.line + 1);
    const pos = new monaco.Position(sLine, Math.max(1, issue.start.column + 1));
    const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
    editor.revealRange(range, monaco.editor.ScrollType.Smooth);
    editor.setSelection(range);
    editor.focus();
  }

  // Preview helpers (same as previously implemented)
  function openPreviewForIssue(issue: Issue) {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const snippets: { before: string; after: string; locationLabel: string }[] = [];
    const edits = issue.fix?.edits || [];
    for (const e of edits) {
      const sLine0 = Math.max(0, e.start.line);
      const eLine0 = Math.max(0, e.end.line);
      const startContext = Math.max(0, sLine0 - 2);
      const endContext = Math.min(model.getLineCount() - 1, eLine0 + 2);

      const contextStartOffset = model.getOffsetAt(new monaco.Position(startContext + 1, 1));
      const contextEndOffset = model.getOffsetAt(new monaco.Position(endContext + 1, model.getLineContent(endContext + 1).length + 1));
      const absoluteAll = model.getValue();
      const startOffset = model.getOffsetAt(new monaco.Position(e.start.line + 1, Math.max(1, e.start.column + 1)));
      const endOffset = model.getOffsetAt(new monaco.Position(e.end.line + 1, Math.max(1, e.end.column + 1)));

      const beforeContext = absoluteAll.slice(contextStartOffset, contextEndOffset);
      const afterContext = absoluteAll.slice(contextStartOffset, startOffset) + e.newText + absoluteAll.slice(endOffset, contextEndOffset);

      snippets.push({
        before: beforeContext,
        after: afterContext,
        locationLabel: `Lines ${startContext + 1}-${endContext + 1}`
      });
    }

    setPreviewIssue(issue);
    setPreviewSnippets(snippets);
    setPreviewVisible(true);
  }

  function closePreview() {
    setPreviewVisible(false);
    setPreviewIssue(null);
    setPreviewSnippets([]);
  }

  function applyPreviewedFix() {
    if (!previewIssue) return;
    applyFixForIssue(previewIssue);
    closePreview();
  }

  // Toolbar handlers exposed to UI
  const handleAnalyzeClick = () => runAnalysisRef.current();
  const handleLoadSample = () => {
    const e = editorRef.current;
    if (!e) return;
    e.setValue(`<img src="hero.jpg"/>\n<button></button>\n<div id="dup"></div>\n<div id="dup"></div>`);
    setTimeout(() => runAnalysisRef.current(), 40);
  };

  const handleGeneratePlaceholders = async () => {
    const e = editorRef.current;
    if (!e) return;
    // call your placeholder server (heuristic) - simple fetch example
    try {
      const res = await fetch("http://localhost:5000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: e.getValue(), mode: "heuristic" })
      });
      const data = await res.json();
      if (data?.edits?.length) {
        // apply edits (server returns zero-based coords)
        const monacoEdits = data.edits.map((ed: any) => {
          const start = new monaco.Range(ed.start.line + 1, ed.start.column + 1, ed.start.line + 1, ed.start.column + 1);
          // we expect inserts at a single point; for replacements the server already gives start/end
          const end = new monaco.Range(ed.end.line + 1, ed.end.column + 1, ed.end.line + 1, ed.end.column + 1);
          const range = new monaco.Range(start.startLineNumber, start.startColumn, end.endLineNumber, end.endColumn);
          return { range, text: ed.newText, forceMoveMarkers: true };
        });
        e.executeEdits("a11y-generate-placeholders", monacoEdits);
        setTimeout(() => runAnalysisRef.current(), 40);
      } else {
        runAnalysisRef.current();
      }
    } catch (err) {
      console.error("generate placeholder failed", err);
    }
  };

  const handleGenerateML = async () => {
    const e = editorRef.current;
    if (!e) return;
    try {
      const res = await fetch("http://localhost:5000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: e.getValue(), mode: "ml" })
      });
      const data = await res.json();
      if (data?.edits?.length) {
        const monacoEdits = data.edits.map((ed: any) => {
          const start = new monaco.Range(ed.start.line + 1, ed.start.column + 1, ed.start.line + 1, ed.start.column + 1);
          const end = new monaco.Range(ed.end.line + 1, ed.end.column + 1, ed.end.line + 1, ed.end.column + 1);
          const range = new monaco.Range(start.startLineNumber, start.startColumn, end.endLineNumber, end.endColumn);
          return { range, text: ed.newText, forceMoveMarkers: true };
        });
        e.executeEdits("a11y-generate-ml", monacoEdits);
        setTimeout(() => runAnalysisRef.current(), 40);
      } else {
        runAnalysisRef.current();
      }
    } catch (err) {
      console.error("generate ml failed", err);
    }
  };

  return (
    <div className="app-root" style={{ display: "flex", height: "100vh" }}>
      {/* Editor column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* toolbar */}
        {/* <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={handleAnalyzeClick}>Analyze</button>
          <button onClick={handleLoadSample}>Load Sample</button>
          <button onClick={handleGeneratePlaceholders} style={{ background: "#16a34a", color: "white" }}>
            Generate Placeholders
          </button>
          <button onClick={handleGenerateML} style={{ background: "#7c3aed", color: "white" }}>
            Generate (ML)
          </button>
          <button onClick={handleFixAll}>Fix All</button>
        </div> */}

        {/* editor container */}
        <div ref={containerRef} className="editor-container" style={{ flex: 1,  overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)" }} />
      </div>

      {/* Right-hand issues panel */}
      <aside style={{ width: 380 }}>
        <IssuesPanel
          issues={issues}
          onFixIssue={applyFixForIssue}
          onJumpIssue={jumpToIssue}
          onPreviewIssue={openPreviewForIssue}
          handleGeneratePlaceholders={handleGeneratePlaceholders}
        />
      </aside>

      {/* preview modal */}
      <PreviewModal
        issue={previewIssue}
        visible={previewVisible}
        snippets={previewSnippets}
        onClose={closePreview}
        onApply={applyPreviewedFix}
      />
    </div>
  );
}
