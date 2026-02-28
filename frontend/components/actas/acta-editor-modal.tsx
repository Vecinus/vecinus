import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Button } from "@/components/ui/button";
import { ActaEditor } from "@/components/actas/acta-editor";

interface ActaEditorModalProps {
  visible: boolean;
  initialContent: string;
  onConfirm: (editedContent: string) => void;
  onClose: () => void;
}

export function ActaEditorModal({
  visible,
  initialContent,
  onConfirm,
  onClose,
}: ActaEditorModalProps) {
  const [editedContent, setEditedContent] = useState(initialContent);

  const handleContentChange = useCallback((html: string) => {
    setEditedContent(html);
  }, []);

  const handleConfirm = () => {
    onConfirm(editedContent);
  };

  // On Android, Modal with visible=false keeps its children mounted (including
  // the tentap WebView). A second WebView (signature canvas) opening while
  // the first is still alive causes touch-event conflicts. Returning null when
  // not visible forces a full unmount of the editor WebView.
  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 bg-background">
          {/* Header */}
          <View className="p-4 border-b border-border flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">
                Revisar transcripción
              </Text>
              <Text className="text-sm text-muted-foreground mt-1">
                Corrige el texto antes de firmar el acta
              </Text>
            </View>
          </View>

          {/* Editor */}
          <View className="flex-1 p-4">
            <ActaEditor
              initialContent={initialContent}
              onChange={handleContentChange}
            />
          </View>

          {/* Actions */}
          <View className="flex-row gap-2 p-4 border-t border-border">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text className="text-sm font-medium text-foreground">
                Cancelar
              </Text>
            </Button>
            <Button className="flex-1 bg-primary" onPress={handleConfirm}>
              <Text className="text-sm font-medium text-primary-foreground">
                Confirmar y firmar
              </Text>
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
