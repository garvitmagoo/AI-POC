// src/shared/analyzer/rules/noPositiveTabindex.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Flags tabindex values > 0 which interfere with natural focus order.
 * Suggest removing tabindex value (replace tabindex="N" with nothing).
 */
export function checkNoPositiveTabindex(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /\btabindex\s*=\s*(['"])([1-9][0-9]*)\1/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const matchIndex = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchLen);

    // Fix: remove the whole attribute (safe)
    const edit: EditRange = {
      start,
      end,
      newText: ""
    };

    const fix: FixSuggestion = {
      title: "Remove positive tabindex to restore natural focus order",
      edits: [edit]
    };

    issues.push({
      id: "no-positive-tabindex",
      message: "Avoid tabindex values greater than 0 — they create confusing focus order.",
      start,
      end,
      fix
    });
  }

  return issues;
}
