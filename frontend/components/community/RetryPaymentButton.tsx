import * as React from 'react';
import { Linking, Modal, View } from 'react-native';
import { CreditCard, RefreshCcw } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRenewSubscription, useRetryPayment } from '@/hooks/useSubscription';
import { getErrorMessage } from '@/lib/error-message';

type Props = {
  communityId: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};


export function RetryPaymentButton({ communityId, onSuccess, onError }: Props) {
  const [open, setOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [renewError, setRenewError] = React.useState<string | null>(null);

  const { mutate: mutateRetry, isPending: isRetrying } = useRetryPayment(communityId);
  const { mutateAsync: mutateRenewAsync, isPending: isRenewing } =
    useRenewSubscription(communityId);

  const handleConfirm = React.useCallback(() => {
    setLocalError(null);
    mutateRetry(undefined, {
      onSuccess: () => {
        setOpen(false);
        onSuccess?.();
      },
      onError: (error) => {
        const message = getErrorMessage(
          error,
          'No se pudo encolar el reintento. Inténtalo de nuevo en unos minutos.',
        );
        setLocalError(message);
        onError?.(message);
      },
    });
  }, [mutateRetry, onSuccess, onError]);

  const handleClose = React.useCallback(() => {
    if (isRetrying) return;
    setOpen(false);
    setLocalError(null);
  }, [isRetrying]);

  const handleRenew = React.useCallback(async () => {
    setRenewError(null);
    try {
      const result = await mutateRenewAsync();
      const url = result.checkout_url;
      if (!url) {
        const message = 'No se recibió la URL de GoCardless. Inténtalo de nuevo en unos segundos.';
        setRenewError(message);
        onError?.(message);
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        const message =
          'Tu dispositivo no admite abrir el enlace. Copia esta URL en tu navegador: ' + url;
        setRenewError(message);
        onError?.(message);
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      const message = getErrorMessage(
        error,
        'No se pudo iniciar el cambio de cuenta bancaria.',
      );
      setRenewError(message);
      onError?.(message);
    }
  }, [mutateRenewAsync, onError]);

  const anyPending = isRetrying || isRenewing;

  return (
    <>
      <View className="gap-3">
        <View className="flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            onPress={() => setOpen(true)}
            disabled={anyPending}
            className="h-12 flex-1 flex-row items-center gap-2 rounded-xl bg-amber-600 dark:bg-amber-500"
          >
            <Icon as={RefreshCcw} size={18} color="#ffffff" />
            <Text className="font-bold text-white">Reintentar cobro</Text>
          </Button>

          <Button
            variant="outline"
            onPress={handleRenew}
            disabled={anyPending}
            className="h-12 flex-1 flex-row items-center gap-2 rounded-xl"
          >
            <Icon as={CreditCard} size={18} className="text-foreground" />
            <Text className="font-semibold text-foreground">
              {isRenewing ? 'Abriendo...' : 'Cambiar cuenta bancaria'}
            </Text>
          </Button>
        </View>

        {renewError ? (
          <View className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <Text className="text-xs text-destructive">{renewError}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-6">
          <View className="w-full max-w-md gap-4 rounded-2xl border border-border bg-background p-6 shadow-xl">
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">
                Reintentar el cobro fallido
              </Text>
              <Text className="text-sm text-muted-foreground">
                Vamos a intentar volver a presentar el último pago al banco.
                Si la causa del fallo
                fue saldo insuficiente, asegúrate de que la cuenta tenga fondos suficientes
                antes de continuar.
              </Text>
            </View>

            {localError ? (
              <View className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <Text className="text-xs text-destructive">{localError}</Text>
              </View>
            ) : null}

            <View className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onPress={handleClose}
                disabled={isRetrying}
                className="h-11"
              >
                <Text>Cancelar</Text>
              </Button>
              <Button
                onPress={handleConfirm}
                disabled={isRetrying}
                className="h-11 bg-amber-600 dark:bg-amber-500"
              >
                <Text className="font-bold text-white">
                  {isRetrying ? 'Solicitando...' : 'Sí, reintentar'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
