import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { paymentsApi } from '@/api/payments';
import { useAuth } from '@/context/AuthContext';



type ScreenState =
  | { kind: 'verifying' }
  | { kind: 'pending'; message: string }
  | { kind: 'error'; message: string };

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const err = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const msg = (detail as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  if (typeof err.message === 'string') return err.message;
  return fallback;
}

export default function GocardlessCompleteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshUserContext } = useAuth();
  const params = useLocalSearchParams<{ order_id?: string | string[] }>();

  const orderId = Array.isArray(params.order_id) ? params.order_id[0] : params.order_id;

  const [state, setState] = React.useState<ScreenState>({ kind: 'verifying' });

  const didRunRef = React.useRef(false);

  const runComplete = React.useCallback(async () => {
    if (!orderId) {
      setState({
        kind: 'error',
        message: 'No se encontró el identificador de la orden de pago en la URL.',
      });
      return;
    }

    setState({ kind: 'verifying' });

    try {
      const updated = await paymentsApi.completeRegistrationOrder(orderId);

      if (updated.created_subscription_id) {

        queryClient.clear();
        await refreshUserContext();
        router.replace('/');
        return;
      }


      setState({
        kind: 'pending',
        message:
          'GoCardless todavía está procesando tu autorización. Espera unos segundos y pulsa "Reintentar verificación".',
      });
    } catch (error) {
      const message = extractErrorMessage(
        error,
        'No se pudo verificar el estado del mandato. Inténtalo de nuevo.',
      );
      setState({ kind: 'error', message });
    }
  }, [orderId, queryClient, refreshUserContext, router]);

  React.useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    void runComplete();
  }, []);

  if (state.kind === 'verifying') {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <ActivityIndicator size="large" />
        <Text className="mt-6 text-base font-semibold text-foreground text-center">
          Verificando el estado de tu suscripción, por favor no cierres esta ventana...
        </Text>
        <Text className="mt-2 text-xs text-muted-foreground text-center">
          Esto solo tarda unos segundos.
        </Text>
      </View>
    );
  }

  const isPending = state.kind === 'pending';
  const IconComponent = isPending ? CheckCircle2 : AlertTriangle;
  const iconBgClass = isPending
    ? 'bg-amber-100 dark:bg-amber-900/40'
    : 'bg-destructive/10';
  const iconColorClass = isPending
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-destructive';
  const title = isPending ? 'Pago aún en proceso' : 'No se pudo verificar el pago';

  return (
    <View className="flex-1 items-center justify-center bg-background p-8">
      <View className={`mb-4 size-16 items-center justify-center rounded-full ${iconBgClass}`}>
        <Icon as={IconComponent} size={28} className={iconColorClass} />
      </View>
      <Text className="text-xl font-bold text-foreground text-center">{title}</Text>
      <Text className="mt-2 text-sm text-muted-foreground text-center">
        {state.message}
      </Text>
      <View className="mt-6 w-full max-w-xs gap-2">
        <Button onPress={runComplete}>
          <Text className="text-primary-foreground font-semibold">
            Reintentar verificación
          </Text>
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/')}>
          <Text>Volver al inicio</Text>
        </Button>
      </View>
    </View>
  );
}
