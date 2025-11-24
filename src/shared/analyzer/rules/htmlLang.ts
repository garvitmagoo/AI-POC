// src/shared/analyzer/rules/htmlLang.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Ensure <html> element has a lang attribute. Suggest adding lang="en".
 */
export function checkHtmlLang(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<html\b([^>]*)>/i;
  const m = re.exec(code);
  if (!m) return issues;

  const attrs = m[1] || "";
  const hasLang = /\blang\s*=\s*(['"])[^'"]+\1/i.test(attrs);
  if (!hasLang) {
    const matchIndex = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchLen);

    // insert into opening tag before '>'
    const insertPos = matchIndex + m[0].lastIndexOf(">");
    const edit: EditRange = {
      start: indexToPosition(code, insertPos),
      end: indexToPosition(code, insertPos),
      newText: ' lang="en"'
    };

    const fix: FixSuggestion = {
      title: "Add lang=\"en\" to <html>",
      edits: [edit]
    };

    issues.push({
      id: "html-lang",
      message: "<html> element should include a valid lang attribute.",
      start,
      end,
      fix
    });
  }

  return issues;
}
