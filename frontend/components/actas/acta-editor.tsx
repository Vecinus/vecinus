import React from "react";
import { ScrollView, TextInput } from "react-native";

interface ActaEditorProps {
  initialContent?: string;
  onChange: (text: string) => void;
}

export function ActaEditor({ initialContent = "", onChange }: ActaEditorProps) {
  return (
    <ScrollView
      style={{ flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8 }}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        defaultValue={initialContent}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        style={{
          flex: 1,
          padding: 16,
          minHeight: 300,
          fontSize: 15,
          color: "#1E293B",
          lineHeight: 22,
        }}
      />
    </ScrollView>
  );
}

