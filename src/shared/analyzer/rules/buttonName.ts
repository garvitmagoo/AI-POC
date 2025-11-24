// src/shared/analyzer/rules/buttonName.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition, escapeRegExp } from "../utils";

/**
 * Flag <button> without accessible name (text, aria-label, aria-labelledby, or title).
 * Suggest adding aria-label="TODO: describe".
 */
export function checkButtonName(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const attrs = m[1] || "";
    const inner = (m[2] || "").trim();

    const hasAria = /\baria-label\s*=\s*(['"])[^'"]+\1/i.test(attrs) || /\baria-labelledby\s*=\s*(['"])[^'"]+\1/i.test(attrs) || /\btitle\s*=\s*(['"])[^'"]+\1/i.test(attrs);

    if (hasAria) continue;
    const visibleText = inner.replace(/<[^>]*>/g, "").trim();
    if (visibleText.length > 0) continue;

    const matchIndex = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchLen);

    // insert aria-label before '>' of opening tag
    const openTagEnd = m[0].indexOf(">"); // relative to m[0]
    const insertPos = matchIndex + (openTagEnd >= 0 ? openTagEnd : 0);
    const edit: EditRange = {
      start: indexToPosition(code, insertPos),
      end: indexToPosition(code, insertPos),
      newText: ' aria-label="TODO: describe"'
    };

    const fix: FixSuggestion = {
      title: "Add aria-label placeholder to button",
      edits: [edit]
    };

    issues.push({
      id: "button-name",
      message: "Button must have an accessible name (text, aria-label, aria-labelledby, or title).",
      start,
      end,
      fix
    });
  }

  return issues;
}
