// src/shared/analyzer/rules/inputLabel.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition, escapeRegExp } from "../utils";

/**
 * Flags input/select/textarea without label association or aria-label/aria-labelledby.
 * Suggest adding aria-label placeholder.
 */
export function checkInputLabel(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<(input|select|textarea)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";

    const hasAria = /\baria-label\s*=\s*(['"])[^'"]+\1/i.test(attrs) || /\baria-labelledby\s*=\s*(['"])[^'"]+\1/i.test(attrs);
    if (hasAria) continue;

    // If has id and a label with for attr exists anywhere -> considered labelled
    const idMatch = /\bid\s*=\s*(['"])([^'"]+)\1/i.exec(attrs);
    if (idMatch) {
      const id = idMatch[2];
      const labRe = new RegExp(`<label\\b[^>]*for\\s*=\\s*(['"])${escapeRegExp(id)}\\1[^>]*>`, "i");
      if (labRe.test(code)) continue;
    }

    const matchIndex = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchLen);

    // insert aria-label before closing '>' of opening tag
    const matchStr = m[0];
    const closeIdx = matchStr.lastIndexOf(">");
    const insertPos = matchIndex + (closeIdx >= 0 ? closeIdx : matchStr.length);

    const edit: EditRange = {
      start: indexToPosition(code, insertPos),
      end: indexToPosition(code, insertPos),
      newText: ' aria-label="TODO: describe"'
    };

    const fix: FixSuggestion = {
      title: `Add aria-label placeholder to ${tag}`,
      edits: [edit]
    };

    issues.push({
      id: "input-label",
      message: `${tag} is missing a visible label or accessible name (aria-label/aria-labelledby or associated <label>).`,
      start,
      end,
      fix
    });
  }

  return issues;
}
