import React from "react";
import { View } from "react-native";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";

interface ActaEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
}

export function ActaEditor({ initialContent = "", onChange }: ActaEditorProps) {
  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent,
  });

  const content = useEditorContent(editor, { type: "html" });

  React.useEffect(() => {
    if (content) {
      onChange(content);
    }
  }, [content, onChange]);

  return (
    <View
      style={{ flex: 1, borderWidth: 1, borderRadius: 8, overflow: "hidden" }}
    >
      <RichText
        editor={editor}
        style={{ flex: 1, padding: 16, minHeight: 200 }}
      />
      <Toolbar editor={editor} />
    </View>
  );
}
