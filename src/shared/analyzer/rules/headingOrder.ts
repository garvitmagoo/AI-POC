// src/shared/analyzer/rules/headingOrder.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Detects skipped heading levels (e.g., h1 -> h3).
 * Conservative auto-fix: change the skipped heading tag to the next logical level (lastLevel + 1).
 * Example: if lastLevel = 1 and current is h3 -> we change it to h2.
 *
 * This is intentionally simple: it only renames the tag (opening and closing),
 * which is reversible (user can undo) and usually correct.
 */
export function checkHeadingOrder(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/(h[1-6])>/gi;
  let m: RegExpExecArray | null;
  let lastLevel: number | null = null;

  while ((m = re.exec(code)) !== null) {
    // m[1] = opening tag name (e.g., h3)
    // m[2] = opening tag attrs (if any)
    // m[3] = inner HTML/text of heading
    // m[4] = closing tag name (should equal m[1], but we use m[4] for end-match length)
    const openTag = m[1].toLowerCase();
    const closeTag = m[4].toLowerCase();
    const currentLevel = parseInt(openTag.charAt(1), 10);
    const matchIndex = m.index;
    const matchLen = m[0].length;
    const start = indexToPosition(code, matchIndex);
    const end = indexToPosition(code, matchIndex + matchLen);

    if (lastLevel !== null && currentLevel > lastLevel + 1) {
      // compute target level = lastLevel + 1 (safe correction)
      const targetLevel = lastLevel + 1;
      const newOpen = `h${targetLevel}`;
      const newClose = `h${targetLevel}`;

      // Find offsets of the exact opening tag and closing tag within the full match
      // Opening tag starts at matchIndex and runs until the first '>' in m[0]
      const openTagText = m[0].slice(0, m[0].indexOf(">") + 1); // e.g. <h3 ...>
      const openingTagStart = matchIndex;
      const openingTagEnd = matchIndex + openTagText.length; // position after '>'

      // The closing tag is at the end of m[0]; find last occurrence of '</'
      const closingTagStartInMatch = m[0].lastIndexOf("</");
      const closingTagStart = matchIndex + closingTagStartInMatch;
      // location of closing tag name within closing tag: "</h3>"
      const closingTagNameStart = closingTagStart + 2; // after '</'
      const closingTagNameEnd = closingTagNameStart + closeTag.length;

      // Edits: replace opening tag name (hN) and closing tag name (hN)
      // We'll replace only the tag *name*, preserving attributes and rest of markup.
      // Compute start/end positions for the tag name in absolute indices:
      // For opening tag name, find index of 'hN' inside the opening text:
      const openingTagNameRelative = openTagText.indexOf(openTag); // index within openTagText
      const openingNameAbs = openingTagStart + openingTagNameRelative;
      const openingNameEndAbs = openingNameAbs + openTag.length;

      const closingNameAbs = closingTagNameStart;
      const closingNameEndAbs = closingTagNameEnd;

      // Build edits (zero-based positions)
      const editOpen: EditRange = {
        start: indexToPosition(code, openingNameAbs),
        end: indexToPosition(code, openingNameEndAbs),
        newText: newOpen
      };
      const editClose: EditRange = {
        start: indexToPosition(code, closingNameAbs),
        end: indexToPosition(code, closingNameEndAbs),
        newText: newClose
      };

      const fix: FixSuggestion = {
        title: `Change ${openTag} → ${newOpen} to fix heading order`,
        edits: [editOpen, editClose]
      };

      issues.push({
        id: "heading-order",
        message: `Heading order skip: <${openTag}> follows h${lastLevel}. Renaming to <${newOpen}> recommended.`,
        start,
        end,
        fix
      });
    }

    // update lastLevel to currentLevel for next iteration
    lastLevel = currentLevel;
  }

  return issues;
}
