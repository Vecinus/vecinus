import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';

import { formatEuros } from '@/components/community/PlanSelector';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InvoicesList } from '@/components/community/InvoicesList';
import { RetryPaymentButton } from '@/components/community/RetryPaymentButton';
import { SubscriptionStatusCard } from '@/components/community/SubscriptionStatusCard';
import { UsageMeters } from '@/components/community/UsageMeters';
import { useAuth } from '@/context/AuthContext';
import {
  subscriptionKeys,
  useSubscriptionStatus,
  useSubscriptionUsage,
} from '@/hooks/useSubscription';

const ADMIN_ROLE = 1;
const PRESIDENT_ROLE = 4;

function isValidId(value: string | undefined): value is string {
  return (
    !!value &&
    value !== 'undefined' &&
    value !== 'null' &&
    value !== '[communityId]'
  );
}

export default function CommunitySubscriptionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, activeCommunity } = useAuth();
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{
    communityId?: string | string[];
  }>();

  const routeCommunityId = Array.isArray(routeCommunityIdRaw)
    ? routeCommunityIdRaw[0]
    : routeCommunityIdRaw;
  const communityId = isValidId(routeCommunityId)
    ? routeCommunityId
    : activeCommunity?.id;

  const membership = React.useMemo(() => {
    if (!user || !communityId) return null;
    return (
      user.CommunitiesAndRole.find((entry) => entry.community.id === communityId) ?? null
    );
  }, [user, communityId]);

  const role = membership ? Number(membership.role) : null;
  const isAdmin = role === ADMIN_ROLE;
  const isPresident = role === PRESIDENT_ROLE;
  const canView = isAdmin || isPresident;

  React.useEffect(() => {
    if (!communityId) return;
    if (!user) return;
    if (membership === null) {
      router.replace('/');
      return;
    }
    if (!canView) {
      router.replace('/');
    }
  }, [communityId, user, membership, canView, router]);

  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErrorObj,
    refetch: refetchStatus,
  } = useSubscriptionStatus(communityId, canView);

  const {
    data: usage,
    isLoading: usageLoading,
    refetch: refetchUsage,
  } = useSubscriptionUsage(communityId, canView);

  useFocusEffect(
    React.useCallback(() => {
      if (!communityId || !canView) return;
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.status(communityId) });
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage(communityId) });
    }, [communityId, canView, queryClient]),
  );

  if (!communityId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Resolviendo comunidad...</Text>
      </View>
    );
  }

  if (!canView) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Redirigiendo...</Text>
      </View>
    );
  }

  if (statusLoading || usageLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Cargando suscripción...</Text>
      </View>
    );
  }

  if (statusError || !status) {
    type ErrorShape = { response?: { status?: number; data?: { detail?: unknown } } };
    const errShape = statusErrorObj as ErrorShape | null | undefined;
    const httpStatus = errShape?.response?.status;
    const detail = errShape?.response?.data?.detail;
    const detailMessage =
      typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && 'message' in detail
          ? String((detail as { message?: unknown }).message ?? '')
          : '';
    const fallback =
      httpStatus === 404
        ? 'Aún no hay una suscripción asociada a esta comunidad.'
        : 'No se pudo cargar el estado de la suscripción. Inténtalo de nuevo en unos segundos.';

    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <View className="mb-4 size-16 items-center justify-center rounded-full bg-destructive/10">
          <Icon as={AlertTriangle} size={28} className="text-destructive" />
        </View>
        <Text className="text-xl font-bold text-foreground text-center">
          No se pudo cargar la suscripción
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground text-center">
          {detailMessage || fallback}
        </Text>
        <Button onPress={() => refetchStatus()} className="mt-6">
          <Text className="text-primary-foreground font-semibold">Reintentar</Text>
        </Button>
      </View>
    );
  }

  const showRetryButton = isAdmin && status.status === 'past_due';
  const activeHouseholdCount = status.household_count ?? 0;
  const pendingHouseholdCount = status.pending_household_count;
  const hasPendingChange = !!status.pending_plan || pendingHouseholdCount !== null;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      onScrollEndDrag={() => {
        void refetchStatus();
        void refetchUsage();
      }}
    >
      <View>
        <Text className="text-2xl font-extrabold text-foreground">Suscripción y pagos</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Comunidad: {activeCommunity?.name ?? communityId}
        </Text>
      </View>

      <SubscriptionStatusCard status={status} />

      {isAdmin ? (
        <View className="rounded-2xl border border-border bg-card p-5 gap-4">
          <View className="gap-1">
            <Text className="text-lg font-bold text-foreground">Plan y límite de viviendas</Text>
            <Text className="text-sm text-muted-foreground">
              Gestiona los cambios de plan desde una pantalla dedicada para revisar mejor el impacto antes de guardarlos.
            </Text>
          </View>

          {hasPendingChange ? (
            <View className="rounded-xl border border-blue-300/60 bg-blue-50 p-4 gap-2 dark:border-blue-700/40 dark:bg-blue-950/30">
              <Text className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Hay un cambio programado para el siguiente ciclo.
              </Text>
              <Text className="text-xs text-blue-900 dark:text-blue-200">
                Próximo ciclo: {status.pending_plan?.display_name ?? status.plan?.display_name ?? '—'} · {pendingHouseholdCount ?? activeHouseholdCount} viviendas · {typeof status.pending_amount_cents === 'number' ? formatEuros(status.pending_amount_cents) : '—'} /mes
              </Text>
              {pendingHouseholdCount !== null && pendingHouseholdCount < activeHouseholdCount ? (
                <Text className="text-xs text-blue-900 dark:text-blue-200">
                  La reducción pendiente ya limita las nuevas altas desde este momento.
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="rounded-xl border border-border/60 bg-background p-4 gap-2">
              <Text className="text-sm text-muted-foreground">
                Plan actual: {status.plan?.display_name ?? '—'}
              </Text>
              <Text className="text-sm text-muted-foreground">
                Límite actual: {activeHouseholdCount} viviendas
              </Text>
              <Text className="text-sm text-muted-foreground">
                Viviendas creadas: {status.current_household_count}
              </Text>
            </View>
          )}

          <Button
            onPress={() => router.push(`/${communityId}/subscription-plan`)}
            className="h-12 rounded-xl"
          >
            <Text className="font-semibold text-primary-foreground">Gestionar plan</Text>
          </Button>
        </View>
      ) : null}

      {usage ? (
        <UsageMeters usage={usage} />
      ) : (
        <View className="rounded-2xl border border-dashed border-border p-6 items-center">
          <Text className="text-xs text-muted-foreground">
            Los contadores de uso se inicializarán tras el primer cobro confirmado.
          </Text>
        </View>
      )}

      <InvoicesList invoices={status.invoices ?? []} />

      {showRetryButton ? (
        <View className="gap-2">
          <RetryPaymentButton
            communityId={communityId}
            onSuccess={() => {
              void refetchStatus();
            }}
          />
          <Text className="text-xs text-muted-foreground text-center">
            La confirmación del reintento llegará cuando se presente el cobro.
          </Text>
        </View>
      ) : null}

      {!isAdmin && status.status === 'past_due' ? (
        <View className="rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-950/30">
          <Text className="text-xs text-amber-900 dark:text-amber-200">
            Sólo el administrador (rol 1) de la comunidad puede reintentar el cobro fallido. Avísale para que regularice la suscripción.
          </Text>
        </View>
      ) : null}

      {status.status === 'mandate_invalid' ? (
        <View className="rounded-md border border-red-300/60 bg-red-50 p-3 dark:border-red-700/40 dark:bg-red-950/30">
          <Text className="text-xs text-red-900 dark:text-red-200">
            El mandato SEPA ya no es válido (cancelado o caducado). Para reactivar la suscripción habrá que firmar un mandato nuevo, función que se habilitará en una próxima iteración.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
