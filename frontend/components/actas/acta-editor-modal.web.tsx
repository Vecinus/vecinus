import React, { useState, useCallback, useEffect } from "react";
import { ActaEditor } from "@/components/actas/acta-editor";
import { COLORS } from "@/lib/colors";

interface ActaEditorModalProps {
  visible: boolean;
  initialContent: string;
  onConfirm: (editedContent: string) => void;
  onClose: () => void;
}

const BORDER = "hsl(214.3 31.8% 91.4%)";

export function ActaEditorModal({
  visible,
  initialContent,
  onConfirm,
  onClose,
}: ActaEditorModalProps) {
  const [editedContent, setEditedContent] = useState(initialContent);

  useEffect(() => {
    setEditedContent(initialContent);
  }, [initialContent]);

  const handleContentChange = useCallback((text: string) => {
    setEditedContent(text);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: `${COLORS.foreground}cc`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.foreground,
            }}
          >
            Revisar transcripcion
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: COLORS.mutedForeground,
            }}
          >
            Corrige el texto antes de firmar el acta
          </p>
        </div>

        {/* Editor */}
        <div
          style={{
            flex: 1,
            padding: 16,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ActaEditor
            initialContent={initialContent}
            onChange={handleContentChange}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              backgroundColor: "transparent",
              color: COLORS.foreground,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(editedContent)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              backgroundColor: COLORS.primary,
              color: COLORS.primaryForeground,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Confirmar y firmar
          </button>
        </div>
      </div>
    </div>
  );
}
