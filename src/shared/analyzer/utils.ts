// src/shared/analyzer/utils.ts
// small utilities used by rules. indexToPosition assumes \n line breaks.

export function indexToPosition(text: string, index: number) {
  // clamp
  const idx = Math.max(0, Math.min(text.length, index));
  let line = 0;
  let col = 0;
  // faster approach: walk and count newlines until index
  let lastNewline = -1;
  for (let i = 0; i < idx; i++) {
    if (text.charCodeAt(i) === 10) { // \n
      line++;
      lastNewline = i;
    }
  }
  col = idx - (lastNewline + 1);
  return { line, column: col };
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
