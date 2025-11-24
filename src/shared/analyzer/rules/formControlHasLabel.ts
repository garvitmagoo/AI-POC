// src/shared/analyzer/rules/formControlHasLabel.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition, escapeRegExp } from "../utils";

/**
 * More thorough form control label check (fields inside forms).
 * Suggests adding aria-label placeholder if missing.
 */
export function checkFormControlLabel(code: string): Issue[] {
  const issues: Issue[] = [];
  // look for form-like inputs as a heuristic
  const re = /<(input|select|textarea)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";

    // skip types that are non-interactive
    if (/type\s*=\s*(['"])(hidden|submit|button|reset)\1/i.test(attrs)) continue;

    const hasAria = /\baria-label\s*=\s*(['"])[^'"]+\1/i.test(attrs) || /\baria-labelledby\s*=\s*(['"])[^'"]+\1/i.test(attrs);
    if (hasAria) continue;

    const idMatch = /\bid\s*=\s*(['"])([^'"]+)\1/i.exec(attrs);
    let labelled = false;
    if (idMatch) {
      const id = idMatch[2];
      const labRe = new RegExp(`<label\\b[^>]*for\\s*=\\s*(['"])${escapeRegExp(id)}\\1[^>]*>`, "i");
      if (labRe.test(code)) labelled = true;
    }

    if (!labelled) {
      const matchIndex = m.index;
      const matchLen = m[0].length;
      const start = indexToPosition(code, matchIndex);
      const end = indexToPosition(code, matchIndex + matchLen);
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
        id: "form-control-has-label",
        message: `${tag} should have an associated label or accessible name.`,
        start,
        end,
        fix
      });
    }
  }

  return issues;
}
