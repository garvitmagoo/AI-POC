// src/shared/analyzer/rules/ariaHiddenFocus.ts
import type { Issue } from "../types";
import { indexToPosition } from "../utils";

/**
 * Detect elements with aria-hidden="true" that still include focusable children or tabindex.
 * Diagnostic-only (auto-fixing could remove aria-hidden but that might be wrong).
 */
export function checkAriaHiddenFocus(code: string): Issue[] {
  const issues: Issue[] = [];
  // find nodes with aria-hidden="true"
  const re = /<([a-zA-Z0-9-]+)\b([^>]*)aria-hidden\s*=\s*(['"])true\3([^>]*)>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const tagStart = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, tagStart);
    const end = indexToPosition(code, tagStart + matchLen);

    // scan inner portion for common focusable elements
    const endTag = `</${m[1]}>`;
    const restFrom = m.index + m[0].length;
    const sectionEnd = code.indexOf(endTag, restFrom);
    const inner = sectionEnd >= 0 ? code.slice(restFrom, sectionEnd) : "";

    const hasFocusable = /\b(tabindex\s*=\s*['"](?:[0-9]|-[0-9])|<a\b|<button\b|<input\b|<select\b|<textarea\b)/i.test(inner) || /\btabindex\s*=\s*['"]\d+['"]/i.test(m[0]);

    if (hasFocusable) {
      issues.push({
        id: "aria-hidden-focus",
        message: "Element has aria-hidden=\"true\" but contains focusable content or tabindex — this will hide content from assistive tech while still allowing keyboard focus.",
        start,
        end,
        fix: null
      });
    }
  }

  return issues;
}
