// src/shared/analyzer/rules/duplicateId.ts
import type { Issue, EditRange, FixSuggestion } from "../types";
import { indexToPosition } from "../utils";

/**
 * Detect duplicate id="..." and suggest making later occurrences unique by appending -1, -2, ...
 */
export function checkDuplicateId(code: string): Issue[] {
  const issues: Issue[] = [];
  const re = /\bid\s*=\s*(['"])([^'"]+)\1/gi;
  const occurrences: { id: string; valueIndex: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(code)) !== null) {
    const id = m[2];
    const matchStr = m[0];
    const valueInMatchIdx = matchStr.indexOf(m[1] + id + m[1]);
    const valueAbsoluteIndex = valueInMatchIdx >= 0 ? m.index + valueInMatchIdx + 1 : m.index + matchStr.indexOf(id);
    occurrences.push({ id, valueIndex: valueAbsoluteIndex });
  }

  const groups: Record<string, number[]> = {};
  occurrences.forEach(o => {
    groups[o.id] = groups[o.id] || [];
    groups[o.id].push(o.valueIndex);
  });

  for (const id in groups) {
    const arr = groups[id];
    if (arr.length <= 1) continue;
    for (let i = 0; i < arr.length; i++) {
      const abs = arr[i];
      const start = indexToPosition(code, abs);
      const end = indexToPosition(code, abs + id.length);
      const baseIssue: Issue = {
        id: "duplicate-id",
        message: `Duplicate id "${id}" found. IDs must be unique in a document.`,
        start,
        end,
        fix: null
      };
      if (i >= 1) {
        const suffix = `-${i}`;
        const newId = id + suffix;
        const edit: EditRange = {
          start,
          end,
          newText: newId
        };
        const fix: FixSuggestion = {
          title: `Make id unique: ${newId}`,
          edits: [edit]
        };
        baseIssue.fix = fix;
      }
      issues.push(baseIssue);
    }
  }

  return issues;
}
