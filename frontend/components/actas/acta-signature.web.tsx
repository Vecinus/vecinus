import React, { useRef } from "react";
import { View, Text, Modal, Dimensions } from "react-native";
import { Button } from "@/components/ui/button";
import {
  SignatureCanvasWeb,
  SignatureCanvasWebRef,
} from "@/components/actas/signature-canvas-web";

interface ActaSignatureProps {
  visible: boolean;
  onSign: (signature: string) => void;
  onClose: () => void;
}

export function ActaSignature({
  visible,
  onSign,
  onClose,
}: ActaSignatureProps) {
  const signatureRef = useRef<SignatureCanvasWebRef>(null);

  const handleSignature = (signature: string) => {
    onSign(signature);
    onClose();
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    signatureRef.current?.readSignature();
  };

  const { height } = Dimensions.get("window");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 items-center justify-center p-4">
        <View className="bg-background rounded-lg w-full max-w-lg overflow-hidden">
          {/* Header */}
          <View className="p-4 border-b border-border">
            <Text className="text-lg font-semibold text-foreground">
              Firmar acta
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Dibuje su firma en el área blanca
            </Text>
          </View>

          {/* Signature Canvas */}
          <View className="bg-white" style={{ height: height * 0.4 }}>
            <SignatureCanvasWeb ref={signatureRef} onOK={handleSignature} />
          </View>

          {/* Actions */}
          <View className="flex-row gap-2 p-4 border-t border-border">
            <Button variant="outline" className="flex-1" onPress={handleClear}>
              <Text className="text-sm font-medium text-foreground">
                Limpiar
              </Text>
            </Button>
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text className="text-sm font-medium text-foreground">
                Cancelar
              </Text>
            </Button>
            <Button className="flex-1" onPress={handleConfirm}>
              <Text className="text-sm font-medium text-primary-foreground">
                Confirmar firma
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
