// src/components/EditorPane.tsx
import type { FC, RefObject, CSSProperties } from "react";

interface Props {
  containerRef: RefObject<HTMLDivElement>;
}

const editorContainerStyle: CSSProperties = {
  flex: 1,
  overflow: "hidden",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
};

const EditorPanel: FC<Props> = ({ containerRef }) => {
  return (
    <div
      ref={containerRef}
      className="editor-container"
      style={editorContainerStyle}
    />
  );
};

export default EditorPanel;
