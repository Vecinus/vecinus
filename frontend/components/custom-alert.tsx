import { Modal, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: 'confirm' | 'success' | 'error';
}

export interface DetailItem {
  id: number;
  type: 'reservation' | 'guest_pass';
  spaceName: string;
  startDate: string;
  endDate?: string;
  statusId: number;
  qrToken: string;
  guestsCount?: number;
}

export type UnifiedBookingItem = {
  uniqueId: string;
  realId: number;
  type: 'reservation' | 'guest_pass';
  spaceName: string;
  startDate: string;
  endDate?: string;
  statusId: number;
};

export function CustomAlertDialog({
  config,
  onConfirm,
  onCancel,
  onAcknowledge,
}: {
  config: AlertConfig;
  onConfirm: () => void;
  onCancel: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <Modal
      transparent
      visible={config.visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/50 items-center justify-center p-6">
        <View className="bg-background rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
          <Text className="text-lg font-bold text-foreground mb-2">{config.title}</Text>
          <Text className="text-muted-foreground mb-6">{config.message}</Text>
          <View className="flex-row justify-end gap-3">
            {config.type === 'confirm' ? (
              <>
                <Button variant="outline" onPress={onCancel}>
                  <Text>No</Text>
                </Button>
                <Button variant="destructive" onPress={onConfirm}>
                  <Text className="text-destructive-foreground">Sí, cancelar</Text>
                </Button>
              </>
            ) : (
              <Button onPress={onAcknowledge}>
                <Text>Aceptar</Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}