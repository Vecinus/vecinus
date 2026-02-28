import React, { useRef } from "react";
import { View, Text, Modal, Dimensions, StyleSheet } from "react-native";
import SignatureCanvas from "react-native-signature-canvas";
import { Button } from "@/components/ui/button";

interface ActaSignatureProps {
  visible: boolean;
  onSign: (signature: string) => void;
  onClose: () => void;
}

const SIGNATURE_WEB_STYLE = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
    width: 100%;
    height: 100%;
    margin: 0;
  }
  .m-signature-pad--body {
    border: none;
    width: 100%;
    height: 100%;
  }
  .m-signature-pad--body canvas {
    width: 100% !important;
    height: 100% !important;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
`;

export function ActaSignature({
  visible,
  onSign,
  onClose,
}: ActaSignatureProps) {
  const signatureRef = useRef<any>(null);
  const { height } = Dimensions.get("window");
  const canvasHeight = height * 0.4;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View className="p-4 border-b border-border">
            <Text className="text-lg font-semibold text-foreground">
              Firmar acta
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Dibuje su firma en el area blanca
            </Text>
          </View>

          {/* Signature Canvas */}
          <View style={[styles.canvasContainer, { height: canvasHeight }]}>
            <SignatureCanvas
              ref={signatureRef}
              onOK={(signature: string) => onSign(signature)}
              onEmpty={() => {}}
              descriptionText=""
              clearText="Limpiar"
              confirmText="Confirmar"
              autoClear={false}
              backgroundColor="rgb(255,255,255)"
              penColor="rgb(0,0,0)"
              androidHardwareAccelerationDisabled={false}
              webStyle={SIGNATURE_WEB_STYLE}
              style={{ flex: 1 }}
            />
          </View>

          {/* Actions */}
          <View className="flex-row gap-2 p-4 border-t border-border">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => signatureRef.current?.clearSignature()}
            >
              <Text className="text-sm font-medium text-foreground">
                Limpiar
              </Text>
            </Button>
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text className="text-sm font-medium text-foreground">
                Cancelar
              </Text>
            </Button>
            <Button
              className="flex-1"
              onPress={() => signatureRef.current?.readSignature()}
            >
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 512,
    overflow: "hidden",
  },
  canvasContainer: {
    backgroundColor: "#fff",
    width: "100%",
  },
});
