// src/shared/analyzer/rules/imageAlt.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Flags <img> with no alt attribute and suggests adding alt="TODO: describe"
 */
export function checkImageAlt(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<img\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const attrs = m[1] || "";
    const hasAlt = /\balt\s*=\s*(['"])[\s\S]*?\1/i.test(attrs);
    if (hasAlt) continue;

    const matchIndex = m.index;
    const matchStr = m[0];
    const closingInMatch = matchStr.lastIndexOf(">");
    const insertPos = matchIndex + (closingInMatch >= 0 ? closingInMatch : matchStr.length);

    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchStr.length);

    const edit: EditRange = {
      start: indexToPosition(code, insertPos),
      end: indexToPosition(code, insertPos),
      newText: ' alt="TODO: describe"'
    };

    const fix: FixSuggestion = {
      title: "Add placeholder alt text",
      edits: [edit]
    };

    issues.push({
      id: "image-alt",
      message: "Image tags should have alt text.",
      start,
      end,
      fix
    });
  }

  return issues;
}
