import type { FC, CSSProperties } from "react";
import type { Issue } from "../../../src/shared/analyzer/types";

type Props = {
  issues: Issue[];
  onFixIssue: (issue: Issue) => void;
  onJumpIssue: (issue: Issue) => void;
  onPreviewIssue: (issue: Issue) => void;
  handleGeneratePlaceholders: () => void;
};

// ---------- Styles ----------

const panelStyle: CSSProperties = {
  background: "linear-gradient(180deg, #020b18, #071826)",
  padding: 16,
  color: "white",
  height: "100%",
  boxSizing: "border-box",
  overflowY: "auto",
  borderLeft: "1px solid rgba(255,255,255,0.05)",
};

const issuesHeaderStyle: CSSProperties = {
  margin: "0 0 14px",
  fontWeight: 600,
};

const emptyStateStyle: CSSProperties = {
  opacity: 0.7,
  fontSize: 14,
};

const issuesListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const issueCardStyle: CSSProperties = {
  borderRadius: 8,
  padding: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  gap: 12,
};

const issueTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "#7dd3fc",
};

const issueMessageStyle: CSSProperties = {
  fontSize: 13,
  margin: "6px 0",
  lineHeight: 1.4,
  color: "rgba(255,255,255,0.85)",
};

const issueMetaStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
};

const actionColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const actionButtonBase: CSSProperties = {
  width: 70,
  height: 32,
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
};

const fixButtonStyle: CSSProperties = {
  ...actionButtonBase,
  background: "#0ea5e9",
  color: "white",
};

const previewButtonStyle: CSSProperties = {
  ...actionButtonBase,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

const jumpButtonStyle: CSSProperties = {
  ...actionButtonBase,
  background: "rgba(255,255,255,0.1)",
  color: "white",
};

const autoFixButtonStyle: CSSProperties = {
  marginTop: 10,
  width: "100%",
  height: 40,
  borderRadius: 8,
  background: "#22c55e",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
};

// ---------- Component ----------

const IssuesPanel: FC<Props> = ({
  issues,
  onFixIssue,
  onJumpIssue,
  onPreviewIssue,
  handleGeneratePlaceholders,
}) => {
  const hasIssues = issues.length > 0;

  return (
    <div style={panelStyle}>
      <h3 style={issuesHeaderStyle}>Accessibility Issues ({issues.length})</h3>

      {!hasIssues && (
        <div style={emptyStateStyle}>
          No issues detected. Paste code on the left and start editing.
        </div>
      )}

      <div style={issuesListStyle}>
        {issues.map((issue, idx) => (
          <div key={`${issue.id}-${idx}`} style={issueCardStyle}>
            <div style={{ flex: 1 }}>
              <div style={issueTitleStyle}>{issue.id}</div>
              <div style={issueMessageStyle}>{issue.message}</div>
              <div style={issueMetaStyle}>Line {issue.start.line + 1}</div>
            </div>

            <div style={actionColumnStyle}>
              <button
                type="button"
                onClick={() => onFixIssue(issue)}
                style={fixButtonStyle}
              >
                Fix
              </button>

              <button
                type="button"
                onClick={() => onPreviewIssue(issue)}
                style={previewButtonStyle}
              >
                Preview
              </button>

              <button
                type="button"
                onClick={() => onJumpIssue(issue)}
                style={jumpButtonStyle}
              >
                Jump
              </button>
            </div>
          </div>
        ))}

        {hasIssues && (
          <button
            type="button"
            onClick={handleGeneratePlaceholders}
            style={autoFixButtonStyle}
          >
            Auto-Fix with AI
          </button>
        )}
      </div>
    </div>
  );
};

export default IssuesPanel;
