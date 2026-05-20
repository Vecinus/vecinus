import * as React from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  PLAN_CATALOG,
  PlanSelector,
  calculateMonthlyAmountCents,
  formatEuros,
} from '@/components/community/PlanSelector';
import { Button } from '@/components/ui/button';
import { CustomAlertDialog, type AlertConfig } from '@/components/custom-alert';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptionStatus, useUpdateSubscription } from '@/hooks/useSubscription';
import { getErrorMessage } from '@/lib/error-message';
import { getHouseholdCountError } from '@/lib/household-count';
import type { PlanCode } from '@/types/payments.types';

const ADMIN_ROLE = 1;

function isValidId(value: string | undefined): value is string {
  return (
    !!value &&
    value !== 'undefined' &&
    value !== 'null' &&
    value !== '[communityId]'
  );
}

function communitySubscriptionHref(communityId: string): Href {
  return `/${communityId}/subscription` as Href;
}

export default function CommunitySubscriptionPlanScreen() {
  const router = useRouter();
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

  const [selectedPlan, setSelectedPlan] = React.useState<PlanCode>('basic');
  const [householdCountText, setHouseholdCountText] = React.useState('1');
  const [householdCountError, setHouseholdCountError] = React.useState<string | null>(null);
  const [alertConfig, setAlertConfig] = React.useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });

  const closeAlert = React.useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = React.useCallback(
    (title: string, message: string, type: AlertConfig['type']) => {
      setAlertConfig({ visible: true, title, message, type });
    },
    [],
  );

  React.useEffect(() => {
    if (!communityId) return;
    if (!user) return;
    if (membership === null || !isAdmin) {
      router.replace(communitySubscriptionHref(communityId));
    }
  }, [communityId, isAdmin, membership, router, user]);

  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
  } = useSubscriptionStatus(communityId, isAdmin);
  const { mutate: mutateSubscription, isPending: isSavingSubscription } =
    useUpdateSubscription(communityId);

  React.useEffect(() => {
    if (!status?.plan?.code) return;
    setSelectedPlan(status.pending_plan?.code ?? status.plan.code);
    setHouseholdCountText(String(status.pending_household_count ?? status.household_count ?? 1));
  }, [status?.plan?.code, status?.pending_plan?.code, status?.pending_household_count, status?.household_count]);

  const parsedHouseholdCount = React.useMemo(() => {
    const parsed = Number.parseInt(householdCountText, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [householdCountText]);

  useEffect(() => {
    setHouseholdCountError(getHouseholdCountError(parsedHouseholdCount));
  }, [parsedHouseholdCount]);

  if (!communityId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Resolviendo comunidad...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Redirigiendo...</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-muted-foreground">Cargando configuración...</Text>
      </View>
    );
  }

  if (isError || !status) {
    const detail = (error as { response?: { data?: { detail?: string } } } | undefined)?.response?.data?.detail;

    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <Text className="text-xl font-bold text-foreground text-center">
          No se pudo cargar la configuración del plan
        </Text>
        <Text className="mt-2 text-sm text-muted-foreground text-center">
          {detail || 'Inténtalo de nuevo en unos segundos.'}
        </Text>
        <Button onPress={() => refetch()} className="mt-6">
          <Text className="text-primary-foreground font-semibold">Reintentar</Text>
        </Button>
      </View>
    );
  }

  const activeHouseholdCount = status.household_count ?? 0;
  const currentHouseholdCount = status.current_household_count ?? 0;
  const pendingHouseholdCount = status.pending_household_count;
  const hasPendingChange = !!status.pending_plan || pendingHouseholdCount !== null;
  const selectedPlanInfo = PLAN_CATALOG[selectedPlan];
  const nextAmountCents = selectedPlanInfo
    ? calculateMonthlyAmountCents(selectedPlanInfo, parsedHouseholdCount)
    : null;
  const hasChanges =
    selectedPlan !== (status.pending_plan?.code ?? status.plan?.code) ||
    parsedHouseholdCount !== (status.pending_household_count ?? status.household_count ?? 1);

  const handleSaveSubscription = () => {
    if (!status.plan) return;
    if (householdCountError) {
      showAlert('Límite no válido', householdCountError, 'error');
      return;
    }
    if (parsedHouseholdCount < currentHouseholdCount) {
      showAlert(
        'Límite no válido',
        `No puedes fijar ${parsedHouseholdCount} viviendas porque actualmente la comunidad ya tiene ${currentHouseholdCount} creadas.`,
        'error',
      );
      return;
    }

    mutateSubscription(
      {
        plan: selectedPlan,
        household_count: parsedHouseholdCount,
      },
      {
        onSuccess: (result) => {
          showAlert('Cambio programado', result.message, 'success');
        },
        onError: (mutationError) => {
          showAlert(
            'No se pudo guardar el cambio',
            getErrorMessage(mutationError, 'Inténtalo de nuevo en unos segundos.'),
            'error',
          );
        },
      },
    );
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      >
        <View className="gap-1">
          <Text className="text-2xl font-extrabold text-foreground">Cambiar plan y límite</Text>
          <Text className="text-sm text-muted-foreground">
            Los cambios de plan e importe se aplicarán en el siguiente ciclo de facturación.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-5 gap-3">
          <Text className="text-sm font-semibold text-foreground">Estado actual</Text>
          <Text className="text-sm text-muted-foreground">
            Plan actual: {status.plan?.display_name ?? '—'}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Límite actual: {activeHouseholdCount} viviendas
          </Text>
          <Text className="text-sm text-muted-foreground">
            Viviendas creadas: {currentHouseholdCount}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Límite operativo actual: {status.operational_household_limit}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-card p-5 gap-4">
          <PlanSelector
            selected={selectedPlan}
            onChange={setSelectedPlan}
            householdCount={parsedHouseholdCount}
            disabled={isSavingSubscription}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Nuevo límite de viviendas</Text>
            <Input
              value={householdCountText}
              onChangeText={(text) => setHouseholdCountText(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              editable={!isSavingSubscription}
              placeholder="1"
              className={householdCountError ? 'border-2 border-destructive' : ''}
            />
            {householdCountError ? (
              <Text className="text-xs text-destructive">{householdCountError}</Text>
            ) : null}
          </View>

          <View className="rounded-xl border border-border/60 bg-background p-4 gap-2">
            <Text className="text-sm text-muted-foreground">
              Próximo plan: {selectedPlanInfo?.name ?? '—'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              Próximo límite: {parsedHouseholdCount} viviendas
            </Text>
            <Text className="text-sm font-semibold text-foreground">
              Próximo importe: {nextAmountCents !== null ? formatEuros(nextAmountCents) : '—'} /mes
            </Text>
          </View>

          {hasPendingChange ? (
            <View className="rounded-md border border-blue-300/60 bg-blue-50 p-3 dark:border-blue-700/40 dark:bg-blue-950/30">
              <Text className="text-xs text-blue-900 dark:text-blue-200">
                Actualmente hay un cambio programado: {status.pending_plan?.display_name ?? status.plan?.display_name ?? '—'} · {pendingHouseholdCount ?? activeHouseholdCount} viviendas · {typeof status.pending_amount_cents === 'number' ? formatEuros(status.pending_amount_cents) : '—'} /mes
              </Text>
            </View>
          ) : null}

          {pendingHouseholdCount !== null && pendingHouseholdCount < activeHouseholdCount ? (
            <View className="rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-950/30">
              <Text className="text-xs text-amber-900 dark:text-amber-200">
                La reducción del límite de viviendas ya restringe nuevas altas desde este momento.
              </Text>
            </View>
          ) : null}

          {pendingHouseholdCount !== null && pendingHouseholdCount > activeHouseholdCount ? (
            <View className="rounded-md border border-slate-300/60 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-950/30">
              <Text className="text-xs text-slate-900 dark:text-slate-200">
                La ampliación de viviendas se habilitará en el siguiente ciclo de facturación.
              </Text>
            </View>
          ) : null}

          <Button
            onPress={handleSaveSubscription}
            disabled={isSavingSubscription || !hasChanges || !!householdCountError}
            className="h-12 rounded-xl"
          >
            <Text className="font-semibold text-primary-foreground">
              {isSavingSubscription ? 'Guardando...' : 'Programar cambio'}
            </Text>
          </Button>

          <Button
            variant="outline"
            onPress={() => router.push(communitySubscriptionHref(communityId))}
            disabled={isSavingSubscription}
            className="h-12 rounded-xl"
          >
            <Text className="font-semibold text-foreground">Volver a suscripción</Text>
          </Button>
        </View>
      </ScrollView>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={closeAlert}
        onCancel={closeAlert}
        onAcknowledge={closeAlert}
      />
    </>
  );
}
