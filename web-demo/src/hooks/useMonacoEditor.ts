import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

export function useMonacoEditor(onChange?: (code: string) => void) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: `<img src="hero.jpg"/>\n<button></button>`,
      language: "plaintext",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      glyphMargin: true,
    });

    editorRef.current = editor;

    const disp = editor.onDidChangeModelContent(() => {
      if (!onChange) return;
      onChange(editor.getValue());
    });

    const onResize = () => editor.layout();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      disp.dispose();
      editor.dispose();
      editorRef.current = null;
    };
  }, [onChange]);

  function getValue(): string {
    return editorRef.current?.getValue() ?? "";
  }

  function applyEditsWithReveal(
    edits: { range: monaco.Range; text: string }[],
    source: string
  ) {
    const editor = editorRef.current;
    if (!editor || !edits.length) return;

    editor.executeEdits(
      source,
      edits.map((e) => ({ ...e, forceMoveMarkers: true }))
    );

    const first = edits[0];
    if (first) {
      setTimeout(() => {
        editor.revealRange(first.range, monaco.editor.ScrollType.Smooth);
        editor.setSelection(first.range);
        editor.focus();
      }, 40);
    }
  }

  function revealPosition(line: number, column: number) {
    const editor = editorRef.current;
    if (!editor) return;

    const pos = new monaco.Position(line, column);
    const range = new monaco.Range(line, column, line, column);
    editor.revealRange(range, monaco.editor.ScrollType.Smooth);
    editor.setSelection(range);
    editor.focus();
  }

  return {
    editorRef,
    containerRef,
    getValue,
    applyEditsWithReveal,
    revealPosition,
  };
}
