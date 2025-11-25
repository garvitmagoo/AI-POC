import type { Issue } from "../../../src/shared/analyzer/types";

type Props = {
  issues: Issue[];
  onFixIssue: (issue: Issue) => void;
  onJumpIssue: (issue: Issue) => void;
  onPreviewIssue: (issue: Issue) => void;
  handleGeneratePlaceholders: () => void;
};

export default function IssuesPanel({
  issues,
  onFixIssue,
  onJumpIssue,
  onPreviewIssue,
  handleGeneratePlaceholders,
}: Props) {
  const panelStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #020b18, #071826)",
    padding: 16,
    color: "white",
    height: "100%",
    boxSizing: "border-box",
    overflowY: "auto",
    borderLeft: "1px solid rgba(255,255,255,0.05)",
  };

  const issueCardStyle: React.CSSProperties = {
    borderRadius: 8,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    gap: 12,
  };

  const actionButtonBase: React.CSSProperties = {
    width: 70,
    height: 32,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
  };

  const actionColumnStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: "0 0 14px", fontWeight: 600 }}>
        Accessibility Issues ({issues.length})
      </h3>

      {issues.length === 0 && (
        <div style={{ opacity: 0.7, fontSize: 14 }}>
          No issues detected. Paste code on the left and start editing.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {issues.map((issue, idx) => (
          <div key={`${issue.id}-${idx}`} style={issueCardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#7dd3fc" }}>
                {issue.id}
              </div>
              <div
                style={{
                  fontSize: 13,
                  margin: "6px 0",
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {issue.message}
              </div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>
                Line {issue.start.line + 1}
              </div>
            </div>

            <div style={actionColumnStyle}>
              {/* Fix button */}
              <button
                onClick={() => onFixIssue(issue)}
                style={{
                  ...actionButtonBase,
                  background: "#0ea5e9",
                  color: "white",
                }}
              >
                Fix
              </button>

              {/* Preview button */}
              <button
                onClick={() => onPreviewIssue(issue)}
                style={{
                  ...actionButtonBase,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                }}
              >
                Preview
              </button>

              {/* Jump button */}
              <button
                onClick={() => onJumpIssue(issue)}
                style={{
                  ...actionButtonBase,
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                Jump
              </button>
            </div>
          </div>
        ))}

        {issues.length > 0 && (
          <button
            onClick={handleGeneratePlaceholders}
            style={{
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
            }}
          >
            Auto-Fix with AI
          </button>
        )}
      </div>
    </div>
  );
}
