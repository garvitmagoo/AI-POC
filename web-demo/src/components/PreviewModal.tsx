// src/components/PreviewModal.tsx
import type { FC, CSSProperties } from "react";
import type { Issue } from "../../../src/shared/analyzer/types";

export interface EditSnippet {
  before: string;
  after: string;
  locationLabel: string;
  selected?: boolean; // used in AI mode
}

interface Props {
  issue: Issue | null;
  snippets: EditSnippet[];
  visible: boolean;
  mode: "issue" | "ai" | null;
  onClose: () => void;
  // selectedIndices is only meaningful for AI mode
  onApply: (selectedIndices?: number[]) => void;
  onToggleSnippet?: (index: number) => void;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  background: "rgba(0,0,0,0.55)",
};

const dialogStyle: CSSProperties = {
  width: "min(1100px, 95%)",
  maxHeight: "85vh",
  background: "#0f1720",
  color: "#e6eef8",
  borderRadius: 8,
  boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
  padding: 18,
  display: "flex",
  flexDirection: "column",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const subtitleStyle: CSSProperties = {
  margin: "6px 0 0 0",
  color: "#bcd3ee",
};

const headerButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const cancelButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  color: "#cbd5e1",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};

const applyButtonBaseStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  color: "white",
  fontSize: 13,
};

const contentWrapperStyle: CSSProperties = {
  marginTop: 14,
  overflow: "auto",
  paddingRight: 6,
};

const snippetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginBottom: 14,
};

const beforeBoxStyle: CSSProperties = {
  background: "#0b1220",
  border: "1px solid #27303a",
  borderRadius: 6,
  padding: 10,
};

const afterBoxStyle: CSSProperties = {
  background: "#071022",
  border: "1px solid #27303a",
  borderRadius: 6,
  padding: 10,
};

const snippetLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 8,
};

const snippetPreStyle: CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 13,
};

const noFixBoxStyle: CSSProperties = {
  padding: 12,
  background: "#07101a",
  borderRadius: 6,
  border: "1px solid #22303a",
};

const noteStyle: CSSProperties = {
  fontSize: 12,
  color: "#9fb0cc",
  marginTop: 12,
};

const listItemStyle: CSSProperties = {
  color: "#9fb0cc",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
  fontSize: 12,
  color: "#cbd5e1",
};

// ---------- Component ----------

const PreviewModal: FC<Props> = ({
  issue,
  snippets,
  visible,
  mode,
  onClose,
  onApply,
  onToggleSnippet,
}) => {
  if (!visible) return null;

  const isAISuggestions = mode === "ai";
  const hasAnySelectedAI = isAISuggestions
    ? snippets.some((s) => s.selected)
    : false;

  const hasFix = isAISuggestions ? hasAnySelectedAI : snippets.length > 0;

  const title = isAISuggestions ? "AI Suggestions" : issue?.id ?? "Preview";
  const subtitle = isAISuggestions
    ? "Select which AI-generated fixes you want to apply."
    : issue?.message ?? "Preview of automatic fix for this issue.";

  const applyButtonStyle: CSSProperties = hasFix
    ? {
        ...applyButtonBaseStyle,
        background: "#0078d4",
        cursor: "pointer",
      }
    : {
        ...applyButtonBaseStyle,
        background: "#334155",
        cursor: "not-allowed",
      };

  const handleApplyClick = () => {
    if (!hasFix) return;

    if (isAISuggestions) {
      const selectedIndices = snippets
        .map((s, idx) => (s.selected ? idx : -1))
        .filter((idx) => idx !== -1);
      onApply(selectedIndices);
    } else {
      onApply(); // issue mode: all-or-nothing
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        <div style={headerRowStyle}>
          <div>
            <h3 style={titleStyle}>{title}</h3>
            <p style={subtitleStyle}>{subtitle}</p>
          </div>

          <div style={headerButtonsStyle}>
            <button type="button" onClick={onClose} style={cancelButtonStyle}>
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyClick}
              disabled={!hasFix}
              style={applyButtonStyle}
            >
              {hasFix
                ? isAISuggestions
                  ? "Apply selected"
                  : "Apply changes"
                : "No automatic fix"}
            </button>
          </div>
        </div>

        <div style={contentWrapperStyle}>
          {snippets.length > 0 ? (
            snippets.map((s, idx) => (
              <div key={idx}>
                {isAISuggestions && (
                  <div style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={s.selected ?? true}
                      onChange={() => onToggleSnippet && onToggleSnippet(idx)}
                    />
                    <span>{s.locationLabel}</span>
                  </div>
                )}

                <div style={snippetGridStyle}>
                  <div style={beforeBoxStyle}>
                    <div style={snippetLabelStyle}>
                      {s.locationLabel} — before
                    </div>
                    <pre style={snippetPreStyle}>{s.before}</pre>
                  </div>

                  <div style={afterBoxStyle}>
                    <div style={snippetLabelStyle}>
                      {s.locationLabel} — after
                    </div>
                    <pre style={snippetPreStyle}>{s.after}</pre>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={noFixBoxStyle}>
              <p style={{ margin: 0, color: "#bcd3ee" }}>
                This rule or suggestion does not have an automatic fix. You can:
              </p>
              <ul style={{ marginTop: 8 }}>
                <li style={listItemStyle}>
                  Manually update the code where the issue is highlighted.
                </li>
                <li style={listItemStyle}>
                  Use the Jump button to navigate to the problem location.
                </li>
              </ul>
            </div>
          )}

          <div style={noteStyle}>
            {isAISuggestions ? (
              <>
                You can uncheck any AI suggestion you don&apos;t want to apply.
                Only selected changes will be applied.
              </>
            ) : (
              <>
                Apply is disabled when no automatic fix is available. You can
                still navigate to the issue and fix it manually.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
