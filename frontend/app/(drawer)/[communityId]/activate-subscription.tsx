import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Hash } from 'lucide-react-native';

import { paymentsApi } from '@/api/payments';
import { CustomAlertDialog, type AlertConfig } from '@/components/custom-alert';
import {
  calculateMonthlyAmountCents,
  formatEuros,
  PLAN_CATALOG,
  PlanSelector,
} from '@/components/community/PlanSelector';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/error-message';
import { getHouseholdCountError } from '@/lib/household-count';
import type { PlanCode, RegistrationPaymentOrderResponse } from '@/types/payments.types';

type Step = 'form' | 'paying';

const ADMIN_ROLE = 1;

function isValidId(value: string | undefined): value is string {
  return !!value && value !== 'undefined' && value !== 'null' && value !== '[communityId]';
}

export default function ActivateSubscriptionScreen() {
  const router = useRouter();
  const { user, activeCommunity } = useAuth();
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{ communityId?: string | string[] }>();

  const routeCommunityId = Array.isArray(routeCommunityIdRaw) ? routeCommunityIdRaw[0] : routeCommunityIdRaw;
  const communityId = isValidId(routeCommunityId) ? routeCommunityId : activeCommunity?.id;

  const membership = React.useMemo(() => {
    if (!user || !communityId) return null;
    return user.CommunitiesAndRole.find((entry) => entry.community.id === communityId) ?? null;
  }, [communityId, user]);

  const communityName = membership?.community.name ?? activeCommunity?.name ?? 'Comunidad';
  const initialHouseholdCount = Math.max(
    1,
    Number(membership?.community.household_count ?? activeCommunity?.household_count ?? 0) || 1,
  );

  const [step, setStep] = useState<Step>('form');
  const [order, setOrder] = useState<RegistrationPaymentOrderResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plan, setPlan] = useState<PlanCode>('basic');
  const [householdCountText, setHouseholdCountText] = useState(String(initialHouseholdCount));
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  const householdCount = useMemo(() => {
    const parsed = Number.parseInt(householdCountText, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [householdCountText]);

  const [householdCountError, setHouseholdCountError] = useState<string | null>(null);

  useEffect(() => {
    setHouseholdCountError(getHouseholdCountError(householdCount));
  }, [householdCount]);

  const monthlyAmountCents = useMemo(
    () => calculateMonthlyAmountCents(PLAN_CATALOG[plan], householdCount),
    [householdCount, plan],
  );

  React.useEffect(() => {
    if (!communityId || !membership) {
      router.replace('/');
      return;
    }
    if (Number(membership.role) !== ADMIN_ROLE) {
      router.replace(`/${communityId}/subscription` as any);
    }
  }, [communityId, membership, router]);

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));
  const showError = (title: string, message: string) =>
    setAlertConfig({ visible: true, title, message, type: 'error' });

  const handleSubmitForm = async () => {
    if (!communityId) {
      showError('Comunidad no disponible', 'No se pudo resolver la comunidad que quieres activar.');
      return;
    }
    if (householdCountError) {
      showError('Número de viviendas no válido', householdCountError);
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await paymentsApi.createSubscriptionActivationOrder(communityId, {
        plan,
        household_count: householdCount,
      });

      if (!created.authorisation_url) {
        showError(
          'Error de pasarela',
          'Hubo un problema con la URL de autorización. Inténtalo de nuevo.',
        );
        return;
      }

      setOrder(created);
      setStep('paying');
    } catch (error) {
      const detail =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          : null;
      if (
        detail &&
        typeof detail === 'object' &&
        'code' in detail &&
        (detail as { code?: unknown }).code === 'household_limit_below_current_usage'
      ) {
        const currentCount = Number((detail as { current_count?: unknown }).current_count ?? 0);
        showError(
          'Número de viviendas no válido',
          currentCount > 0
            ? `No puedes indicar menos viviendas de las que ya existen en la comunidad. Mínimo actual: ${currentCount}.`
            : 'No puedes indicar menos viviendas de las que ya existen en la comunidad.',
        );
        return;
      }
      showError(
        'No se pudo iniciar la activación',
        getErrorMessage(error, 'Error de red al crear la orden de activación.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGateway = async () => {
    if (!order?.authorisation_url) return;

    try {
      const supported = await Linking.canOpenURL(order.authorisation_url);
      if (!supported) {
        showError(
          'No se puede abrir la pasarela',
          `Tu dispositivo no admite abrir el enlace. Copia esta URL en tu navegador: ${order.authorisation_url}`,
        );
        return;
      }
      await Linking.openURL(order.authorisation_url);
    } catch (error) {
      showError(
        'No se pudo abrir la pasarela',
        getErrorMessage(error, 'Error inesperado al abrir el enlace.'),
      );
    }
  };

  const renderFormStep = () => (
    <View>
      <View className="mb-8 mt-4 items-center">
        <View className="mb-4 size-16 items-center justify-center rounded-full bg-primary/10">
          <Icon as={Building2} size={32} className="text-primary" />
        </View>
        <Text className="text-center text-2xl font-bold text-foreground">Activar suscripción</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          La comunidad ya existe. Solo falta autorizar y activar la suscripción mensual.
        </Text>
      </View>

      <View className="gap-4 rounded-2xl border border-border bg-card p-5 mb-6">
        <Text className="text-xs uppercase tracking-wide text-muted-foreground">Comunidad</Text>
        <Text className="text-lg font-semibold text-foreground">{communityName}</Text>
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="ml-1 text-sm font-medium text-foreground">Nº de viviendas</Text>
          <View className="relative justify-center">
            <View className="absolute left-3 z-10">
              <Icon as={Hash} size={20} className="text-muted-foreground" />
            </View>
            <Input
              placeholder="1"
              value={householdCountText}
              onChangeText={(text) => setHouseholdCountText(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              editable={!isSubmitting}
              className={householdCountError ? 'h-12 pl-10 border-2 border-destructive' : 'h-12 pl-10'}
            />
          </View>
          <Text className="text-xs text-muted-foreground ml-1">
            Este valor se usará para calcular la cuota mensual y actualizar la configuración de la comunidad.
          </Text>
          {householdCountError ? (
            <Text className="text-xs text-destructive ml-1">{householdCountError}</Text>
          ) : null}
        </View>

        <View className="mt-2">
          <Text className="ml-1 mb-2 text-sm font-medium text-foreground">Plan de suscripción</Text>
          <PlanSelector
            selected={plan}
            onChange={setPlan}
            householdCount={householdCount}
            disabled={isSubmitting}
          />
        </View>
      </View>

      <View className="mt-8 gap-3">
        <Button onPress={handleSubmitForm} disabled={isSubmitting || !!householdCountError} className="h-14 rounded-xl">
          <Text className="text-lg font-bold text-primary-foreground">
            {isSubmitting ? 'Procesando...' : 'Continuar al pago'}
          </Text>
        </Button>
        <Button variant="ghost" onPress={() => router.back()} disabled={isSubmitting} className="h-12">
          <Text className="text-foreground">Cancelar</Text>
        </Button>
      </View>
    </View>
  );

  const renderPayingStep = () => (
    <View>
      <View className="mb-6 mt-4 items-center">
        <Text className="text-center text-2xl font-bold text-foreground">Resumen y pago</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Revisa los datos y abre la pasarela pago para autorizar el mandato.
        </Text>
      </View>


      <View className="gap-3 rounded-2xl border border-border bg-card p-5">
        <SummaryRow label="Comunidad" value={communityName} />
        <SummaryRow label="Plan" value={`${PLAN_CATALOG[plan].name} (${householdCount} viviendas)`} />
        <SummaryRow label="Importe del primer mes" value={formatEuros(monthlyAmountCents)} emphasis />
        <SummaryRow label="Renovación" value="Mensual mientras la suscripción esté activa" small />
      </View>

      <View className="mt-8 gap-3">
        <Button onPress={handleOpenGateway} className="h-14 rounded-xl">
          <Text className="text-lg font-bold text-primary-foreground">Pagar</Text>
        </Button>
        <Button variant="ghost" onPress={() => setStep('form')} className="h-12">
          <Text className="text-foreground">Volver atrás</Text>
        </Button>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'form' ? renderFormStep() : null}
        {step === 'paying' ? renderPayingStep() : null}
      </ScrollView>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={() => closeAlert()}
        onCancel={() => closeAlert()}
        onAcknowledge={() => closeAlert()}
      />
    </KeyboardAvoidingView>
  );
}

function SummaryRow({
  label,
  value,
  emphasis = false,
  small = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  small?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className={small ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>{label}</Text>
      <Text
        className={
          emphasis
            ? 'text-base font-bold text-foreground text-right'
            : small
              ? 'text-xs text-foreground text-right'
              : 'text-sm font-medium text-foreground text-right'
        }
      >
        {value}
      </Text>
    </View>
  );
}
