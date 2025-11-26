import { useCallback, useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { analyzeCode } from "../../../src/shared/analyzer";
import type { Issue } from "../../../src/shared/analyzer/types";

export function useIssues(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const decorationIdsRef = useRef<string[]>([]);

  // Stable function, so effects depending on it won't loop
  const runAnalysis = useCallback((code: string) => {
    try {
      const res = analyzeCode(code) || [];
      setIssues(res);
    } catch (err) {
      console.error("analysis error", err);
      setIssues([]);
    }
  }, []);

  // Apply Monaco decorations whenever issues change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const old = decorationIdsRef.current || [];
    decorationIdsRef.current = [];

    const decs: monaco.editor.IModelDeltaDecoration[] = issues.map((issue) => {
      const sLine = Math.max(1, issue.start.line + 1);
      const sCol = Math.max(1, issue.start.column + 1);
      const eLine = Math.max(sLine, issue.end.line + 1);
      const eCol = Math.max(sCol, issue.end.column + 1);

      return {
        range: new monaco.Range(sLine, sCol, eLine, eCol),
        options: {
          inlineClassName: "a11y-highlight",
          glyphMarginClassName: "a11y-gutter",
          hoverMessage: { value: `**${issue.id}** — ${issue.message}` },
        },
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(old, decs);
  }, [issues, editorRef]);

  const buildEditsFromIssue = useCallback(
    (issue: Issue) => {
      const editor = editorRef.current;
      if (!editor || !issue.fix?.edits?.length) return [];

      return issue.fix.edits.map((e) => {
        const sLine = Math.max(1, e.start.line + 1);
        const sCol = Math.max(1, e.start.column + 1);
        const eLine = Math.max(1, e.end.line + 1);
        const eCol = Math.max(1, e.end.column + 1);

        return {
          range: new monaco.Range(sLine, sCol, eLine, eCol),
          text: e.newText,
        };
      });
    },
    [editorRef]
  );

  return {
    issues,
    runAnalysis,
    buildEditsFromIssue,
  };
}
