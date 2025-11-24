// src/components/PreviewModal.tsx
import React from "react";
import type { Issue } from "../../../src/shared/analyzer/types";

interface EditSnippet {
  before: string;
  after: string;
  locationLabel: string;
}

interface Props {
  issue: Issue | null;
  snippets: EditSnippet[];
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * PreviewModal handles both analyzer rules with edits and python-generated edits.
 */
export default function PreviewModal({ issue, snippets, visible, onClose, onApply }: Props) {
  if (!visible) return null;

  const hasFix = Array.isArray(issue?.fix?.edits) ? issue!.fix!.edits!.length > 0 : snippets.length > 0;

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
        background: "rgba(0,0,0,0.55)"
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "min(1100px, 95%)", maxHeight: "85vh", background: "#0f1720", color: "#e6eef8", borderRadius: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.6)", padding: 18, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{issue?.id ?? "AI Suggestions"}</h3>
            <p style={{ margin: "6px 0 0 0", color: "#bcd3ee" }}>{issue?.message ?? "Suggested placeholders from generator"}</p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid #334155", color: "#cbd5e1", padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}>Cancel</button>

            <button onClick={onApply} disabled={!hasFix} style={{ background: hasFix ? "#0078d4" : "#334155", border: "none", color: "white", padding: "6px 12px", borderRadius: 6, cursor: hasFix ? "pointer" : "not-allowed" }}>
              {hasFix ? "Apply" : "No automatic fix"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, overflow: "auto", paddingRight: 6 }}>
          {snippets.length > 0 ? (
            snippets.map((s, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div style={{ background: "#0b1220", border: "1px solid #27303a", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{s.locationLabel} — before</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{s.before}</pre>
                </div>

                <div style={{ background: "#071022", border: "1px solid #27303a", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{s.locationLabel} — after</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{s.after}</pre>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 12, background: "#07101a", borderRadius: 6, border: "1px solid #22303a" }}>
              <p style={{ margin: 0, color: "#bcd3ee" }}>This rule or suggestion does not have an automatic fix. You can:</p>
              <ul style={{ marginTop: 8 }}>
                <li style={{ color: "#9fb0cc" }}>Manually update the code where the issue is highlighted.</li>
                <li style={{ color: "#9fb0cc" }}>Use the Jump button to navigate to the problem location.</li>
              </ul>
            </div>
          )}

          <div style={{ fontSize: 12, color: "#9fb0cc", marginTop: 12 }}>Note: Apply is disabled when no automatic fix is available. You can still jump to the issue and fix manually.</div>
        </div>
      </div>
    </div>
  );
}
