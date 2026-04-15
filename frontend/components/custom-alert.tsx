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
  requiresQr: boolean;
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
    <Modal transparent visible={config.visible} animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
          <Text className="mb-2 text-lg font-bold text-foreground">{config.title}</Text>
          <Text className="mb-6 text-muted-foreground">{config.message}</Text>
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

export function CustomAlertDeleteDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
          <Text className="mb-2 text-lg font-bold text-foreground">{title}</Text>
          <Text className="mb-6 text-muted-foreground">{message}</Text>
          <View className="flex-row justify-end gap-3">
            <Button variant="outline" onPress={onCancel} disabled={isLoading}>
              <Text>Cancelar</Text>
            </Button>
            <Button variant="destructive" onPress={onConfirm} disabled={isLoading}>
              <Text className="text-destructive-foreground">
                {isLoading ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
