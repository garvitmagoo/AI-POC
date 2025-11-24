// src/shared/analyzer/types.ts
export type Pos = { line: number; column: number }; // zero-based (line, column)

export type EditRange = {
  start: Pos; // inclusive, zero-based
  end: Pos;   // exclusive-ish, zero-based
  newText: string;
};

export type FixSuggestion = {
  title?: string;
  edits?: EditRange[];
} | null;

export type Issue = {
  id: string;
  message: string;
  start: Pos;
  end: Pos;
  fix?: FixSuggestion; // optional / can be null
};
