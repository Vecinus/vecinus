import * as React from 'react';
import { View } from 'react-native';
import { CheckCircle2, Clock, XCircle, Receipt, AlertOctagon, type LucideIcon } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { formatEuros } from '@/components/community/PlanSelector';
import type { InvoiceStatus, SubscriptionInvoice } from '@/types/payments.types';

type Props = {
  invoices: SubscriptionInvoice[];
};

type InvoiceVisual = {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  badgeClass: string;
};

const VISUALS: Record<InvoiceStatus, InvoiceVisual> = {
  pending_submission: {
    label: 'Pendiente de envío',
    icon: Clock,
    iconColor: '#64748b',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  submitted: {
    label: 'Enviada al banco',
    icon: Clock,
    iconColor: '#2563eb',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  confirmed: {
    label: 'Confirmada',
    icon: CheckCircle2,
    iconColor: '#059669',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  paid_out: {
    label: 'Liquidada',
    icon: CheckCircle2,
    iconColor: '#059669',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  failed: {
    label: 'Fallida',
    icon: XCircle,
    iconColor: '#dc2626',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
  cancelled: {
    label: 'Cancelada',
    icon: XCircle,
    iconColor: '#dc2626',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
  charged_back: {
    label: 'Devuelta',
    icon: AlertOctagon,
    iconColor: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  },
};

const FALLBACK: InvoiceVisual = {
  label: 'Estado desconocido',
  icon: Clock,
  iconColor: '#64748b',
  badgeClass: 'bg-muted text-muted-foreground',
};

function visualFor(status: string): InvoiceVisual {
  return VISUALS[status as InvoiceStatus] ?? FALLBACK;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function InvoicesList({ invoices }: Props) {
  if (!invoices || invoices.length === 0) {
    return (
      <View className="rounded-2xl border border-dashed border-border p-6 items-center">
        <Icon as={Receipt} size={28} className="text-muted-foreground" />
        <Text className="mt-2 text-sm font-medium text-foreground">Sin cobros aún</Text>
        <Text className="mt-1 text-xs text-muted-foreground text-center">
          Cuando se emita el primer cobro mensual aparecerá aquí.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-border bg-card overflow-hidden">
      <View className="px-5 py-3 border-b border-border/60">
        <Text className="text-base font-bold text-foreground">Histórico de cobros</Text>
      </View>

      {invoices.map((invoice, index) => {
        const visual = visualFor(invoice.status);
        const isLast = index === invoices.length - 1;
        return (
          <View
            key={invoice.id}
            className={cn(
              'px-5 py-3 flex-row items-start gap-3',
              !isLast && 'border-b border-border/40',
            )}
          >
            <View className="pt-0.5">
              <Icon as={visual.icon} size={18} color={visual.iconColor} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-sm font-semibold text-foreground">
                  {formatDate(invoice.charge_date ?? invoice.created_at)}
                </Text>
                <Text className="text-sm font-bold text-foreground">
                  {formatEuros(invoice.amount_cents)}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center gap-2 flex-wrap">
                <View className={cn('rounded-full px-2 py-0.5', visual.badgeClass)}>
                  <Text className={cn('text-[10px] font-semibold uppercase', visual.badgeClass)}>
                    {visual.label}
                  </Text>
                </View>
                <Text className="text-[11px] text-muted-foreground">
                  {invoice.gocardless_payment_id}
                </Text>
              </View>
              {invoice.failure_reason ? (
                <Text className="mt-1 text-xs text-destructive">
                  Motivo: {invoice.failure_reason}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
