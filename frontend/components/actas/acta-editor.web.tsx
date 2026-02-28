import React, { useState, useEffect } from "react";
import { COLORS } from "@/lib/colors";

interface ActaEditorProps {
  initialContent?: string;
  onChange: (text: string) => void;
}

const BORDER = "hsl(214.3 31.8% 91.4%)";

export function ActaEditor({ initialContent = "", onChange }: ActaEditorProps) {
  const [value, setValue] = useState(initialContent);

  useEffect(() => {
    setValue(initialContent);
  }, [initialContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);
    onChange(text);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
      <textarea
        value={value}
        onChange={handleChange}
        autoFocus
        style={{
          flex: 1,
          minHeight: 300,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          backgroundColor: "#fff",
          color: COLORS.foreground,
          fontSize: 14,
          lineHeight: 1.6,
          resize: "vertical",
          fontFamily: "inherit",
          outline: "none",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = COLORS.primary;
          e.target.style.boxShadow = `0 0 0 2px ${COLORS.primary}33`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = BORDER;
          e.target.style.boxShadow = "none";
        }}
        placeholder="Transcripcion de la sesion..."
      />
    </div>
  );
}
