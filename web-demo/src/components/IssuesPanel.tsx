import type { Issue } from "../../../src/shared/analyzer/types";

type Props = {
  issues: Issue[];
  onFixIssue: (issue: Issue) => void;
  onJumpIssue: (issue: Issue) => void;
  onPreviewIssue: (issue: Issue) => void;
  handleGeneratePlaceholders: () => void;
};

export default function IssuesPanel({ issues, onFixIssue, onJumpIssue, onPreviewIssue, handleGeneratePlaceholders }: Props) {
  return (
    <div style={{
      background: "linear-gradient(180deg,#031025, #071826)",
      padding: 12,
      color: "white",
      height: "100%",
      boxSizing: "border-box",
      overflowY: "auto"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Accessibility Issues ({issues.length})</h3>
        {/* Keep a small Fix All here if desired; we moved Fix All to top toolbar so it's optional */}
      </div>

      {issues.length === 0 && (
        <div style={{ opacity: 0.75 }}>No issues found.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {issues.map((issue, idx) => (
          <div key={`${issue.id}-${idx}`} style={{
            borderRadius: 8,
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
            display: "flex",
            gap: 12,
            alignItems: "flex-start"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#9ad6ff", marginBottom: 6 }}>{issue.id}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>{issue.message}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Line {issue.start.line + 1}</div>
            </div>

            {/* compact actions: small icon-like buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => onFixIssue(issue)}
                title="Apply fix"
                style={{
                  width: 64,
                  height: 36,
                  borderRadius: 8,
                  background: "#0ea5e9",
                  color: "white",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Fix
              </button>

              <button
                onClick={() => onPreviewIssue(issue)}
                title="Preview fix"
                style={{
                  width: 64,
                  height: 36,
                  borderRadius: 8,
                  background: "transparent",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer"
                }}
              >
                Preview
              </button>

              <button
                onClick={() => onJumpIssue(issue)}
                title="Jump to location"
                style={{
                  width: 64,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Jump
              </button>
            </div>
          </div>
        ))}
        {issues.length !== 0 &&
        <button
                onClick={handleGeneratePlaceholders}
                title="Apply heuristics fix "
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 8,
                  background: "#0ea5e9",
                  color: "white",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Heuristics Fix
              </button>
}
      </div>
    </div>
  );
}
