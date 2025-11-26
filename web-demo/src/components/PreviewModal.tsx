// web-demo/src/components/PreviewModal.tsx
import React from "react";
import type { Issue } from "../../../src/shared/analyzer/types";
import type { EditSnippet, PreviewMode } from "../types";

interface Props {
  issue: Issue | null;
  snippets: EditSnippet[];
  visible: boolean;
  mode: PreviewMode;
  onClose: () => void;
  onApply: (indices?: number[]) => void;
  onToggleSnippet: (index: number) => void;
}

export default function PreviewModal({
  issue,
  snippets,
  visible,
  mode,
  onClose,
  onApply,
  onToggleSnippet,
}: Props) {
  if (!visible) return null;

  const isAiMode = mode === "ai";
  const hasSnippets = snippets && snippets.length > 0;

  const headerTitle = isAiMode
    ? "AI Suggestions"
    : issue?.id || "Suggested Fix";

  const headerSubtitle = isAiMode
    ? "Select which AI-generated fixes you want to apply."
    : issue?.message || "Preview the proposed fix before applying.";

  const handleApplyClick = () => {
    onApply(); // use selected flags; mapping is done in useAiFixes
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 95%)",
          maxHeight: "85vh",
          background: "#020617",
          color: "#e6eef8",
          borderRadius: 10,
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{headerTitle}</h3>
            <p
              style={{
                margin: "6px 0 0 0",
                color: "#9ca3af",
                fontSize: 14,
              }}
            >
              {headerSubtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #374151",
                color: "#e5e7eb",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApplyClick}
              disabled={!hasSnippets}
              style={{
                background: hasSnippets ? "#3b82f6" : "#1f2937",
                border: "none",
                color: "white",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: hasSnippets ? "pointer" : "not-allowed",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {isAiMode ? "Apply selected" : "Apply"}
            </button>
          </div>
        </div>

        {/* Snippets list */}
        <div
          style={{
            marginTop: 4,
            overflow: "auto",
            paddingRight: 4,
          }}
        >
          {hasSnippets ? (
            snippets.map((s, idx) => {
              const checked = s.selected !== false;

              return (
                <div
                  key={idx}
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 10,
                    background: "#0b1220",
                    border: "1px solid #1f2937",
                  }}
                >
                  {/* Header Row with checkbox + label */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    {/* Checkbox + label horizontally */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#e5e7eb",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSnippet(idx)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <span>{s.locationLabel}</span>
                    </label>

                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Suggested change
                    </span>
                  </div>

                  {/* Before/After Code Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: 6,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          marginBottom: 6,
                        }}
                      >
                        {s.locationLabel} — before
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 13,
                        }}
                      >
                        {s.before}
                      </pre>
                    </div>

                    <div
                      style={{
                        background: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: 6,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          marginBottom: 6,
                        }}
                      >
                        {s.locationLabel} — after
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 13,
                        }}
                      >
                        {s.after}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: 12,
                background: "#020617",
                borderRadius: 6,
                border: "1px solid #1f2933",
                fontSize: 14,
                color: "#e5e7eb",
              }}
            >
              No automatic fix preview is available for this rule.
            </div>
          )}

          {isAiMode && (
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginTop: 8,
              }}
            >
              You can uncheck any AI suggestion you don't want to apply. Only
              selected changes will be applied.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
