import type { Issue } from "../../src/shared/analyzer/types";

export type PreviewMode = "issue" | "ai" | null;

export interface EditSnippet {
  before: string;
  after: string;
  locationLabel: string;
  selected?: boolean;
}

export interface PreviewState {
  visible: boolean;
  mode: PreviewMode;
  issue: Issue | null;
  snippets: EditSnippet[];
}
