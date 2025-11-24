// src/shared/analyzer/rules/linkName.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Flags anchor tags without accessible name. If anchor contains only an <img> missing alt,
 * suggest adding alt on the <img>. Otherwise suggest adding aria-label on the <a>.
 */
export function checkLinkName(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const attrs = m[1] || "";
    const inner = (m[2] || "").trim();

    const hasAria = /\baria-label\s*=\s*(['"])[^'"]+\1/i.test(attrs);
    if (hasAria) continue;

    const visibleText = inner.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    const aStart = m.index;
    const aEnd = m.index + m[0].length;
    const start = indexToPosition(code, aStart);
    const end = indexToPosition(code, aEnd);

    if (visibleText.length === 0) {
      // check for img inside
      const imgMatch = /<img\b([^>]*)>/i.exec(inner);
      if (imgMatch) {
        const imgAttrs = imgMatch[1] || "";
        const hasAlt = /\balt\s*=\s*(['"])[\s\S]*?\1/i.test(imgAttrs);
        if (!hasAlt) {
          const innerOffset = m.index + m[0].indexOf(inner);
          const imgIndexInInner = inner.indexOf(imgMatch[0]);
          const absoluteImgStart = innerOffset + imgIndexInInner;
          const imgMatchStr = imgMatch[0];
          const closingInMatch = imgMatchStr.lastIndexOf(">");
          const insertPos = absoluteImgStart + (closingInMatch >= 0 ? closingInMatch : imgMatchStr.length);

          const edit: EditRange = {
            start: indexToPosition(code, insertPos),
            end: indexToPosition(code, insertPos),
            newText: ' alt="TODO: describe"'
          };

          const fix: FixSuggestion = {
            title: "Add alt placeholder to image inside link",
            edits: [edit]
          };

          issues.push({
            id: "link-name",
            message: "Link contains an image without alt text — provide an accessible name.",
            start,
            end,
            fix
          });
          continue;
        }
      }

      // otherwise suggest aria-label on anchor
      const openTagEnd = m[0].indexOf(">");
      const insertPos = m.index + (openTagEnd >= 0 ? openTagEnd : 0);
      const edit: EditRange = {
        start: indexToPosition(code, insertPos),
        end: indexToPosition(code, insertPos),
        newText: ' aria-label="TODO: describe"'
      };

      const fix: FixSuggestion = {
        title: "Add aria-label placeholder to link",
        edits: [edit]
      };

      issues.push({
        id: "link-name",
        message: "Link has no accessible name — add visible text or aria-label.",
        start,
        end,
        fix
      });
    }
  }

  return issues;
}
