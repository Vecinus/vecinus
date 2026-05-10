import * as React from 'react';
import { View } from 'react-native';
import { CheckCircle2, AlertTriangle, Ban, Clock, ShieldX, type LucideIcon } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { formatEuros } from '@/components/community/PlanSelector';
import type { SubscriptionStatusResponse, SubscriptionStatusValue } from '@/types/payments.types';

type Props = {
  status: SubscriptionStatusResponse;
};

type StatusVisual = {
  label: string;
  pill: string;
  icon: LucideIcon;
  iconColor: string;
};

const STATUS_VISUALS: Record<SubscriptionStatusValue, StatusVisual> = {
  active: {
    label: 'Activa',
    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    icon: CheckCircle2,
    iconColor: '#059669',
  },
  pending_first_payment: {
    label: 'Esperando primer cobro',
    pill: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    icon: Clock,
    iconColor: '#2563eb',
  },
  past_due: {
    label: 'Cobro fallido (impago)',
    pill: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    icon: AlertTriangle,
    iconColor: '#d97706',
  },
  suspended: {
    label: 'Suspendida',
    pill: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
    icon: ShieldX,
    iconColor: '#ea580c',
  },
  cancelled: {
    label: 'Cancelada',
    pill: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
    icon: Ban,
    iconColor: '#dc2626',
  },
  mandate_invalid: {
    label: 'Mandato inválido',
    pill: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
    icon: ShieldX,
    iconColor: '#dc2626',
  },
};

const FALLBACK_VISUAL: StatusVisual = {
  label: 'Estado desconocido',
  pill: 'bg-muted text-muted-foreground',
  icon: AlertTriangle,
  iconColor: '#64748b',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function visualFor(value: string): StatusVisual {
  return STATUS_VISUALS[value as SubscriptionStatusValue] ?? FALLBACK_VISUAL;
}

export function SubscriptionStatusCard({ status }: Props) {
  const visual = visualFor(status.status);
  const planName = status.plan?.display_name ?? 'Plan no identificado';
  const amount = typeof status.current_amount_cents === 'number'
    ? formatEuros(status.current_amount_cents)
    : '—';
  const householdCount = status.household_count ?? 0;
  const currentHouseholdCount = status.current_household_count ?? 0;

  return (
    <View className="rounded-2xl border border-border bg-card p-5 gap-4">
      {/* Cabecera con badge de estado */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2 flex-1">
          <Icon as={visual.icon} size={22} color={visual.iconColor} />
          <View className={cn('rounded-full px-3 py-1', visual.pill)}>
            <Text className={cn('text-xs font-semibold', visual.pill)}>{visual.label}</Text>
          </View>
        </View>
        {status.failure_count > 0 ? (
          <Text className="text-xs text-muted-foreground">
            {status.failure_count} fallo{status.failure_count === 1 ? '' : 's'} acumulado{status.failure_count === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {/* Plan + importe */}
      <View>
        <Text className="text-2xl font-bold text-foreground">{planName}</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          {amount}
          <Text className="text-xs text-muted-foreground"> /mes</Text>
          {householdCount > 0 ? (
            <Text className="text-xs text-muted-foreground"> · {householdCount} viviendas</Text>
          ) : null}
        </Text>
      </View>

      {/* Detalles tabulares */}
      <View className="gap-2 border-t border-border/60 pt-3">
        <DetailRow label="Mandato SEPA" value={status.mandate_status ?? '—'} />
        {householdCount > 0 ? (
          <DetailRow label="Viviendas" value={`${currentHouseholdCount} / ${householdCount}`} />
        ) : null}
        <DetailRow label="Próximo cobro" value={formatDate(status.current_period_end)} />
        <DetailRow label="Último cobro confirmado" value={formatDateTime(status.last_payment_at)} />
        {status.last_failure_at ? (
          <DetailRow label="Último fallo" value={formatDateTime(status.last_failure_at)} />
        ) : null}
        {status.cancelled_at ? (
          <DetailRow label="Cancelación" value={formatDateTime(status.cancelled_at)} />
        ) : null}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground text-right flex-shrink">{value}</Text>
    </View>
  );
}
