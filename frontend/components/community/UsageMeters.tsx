import * as React from 'react';
import { View } from 'react-native';
import { Bot, FileText } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { SubscriptionUsageResponse } from '@/types/payments.types';

type Props = {
  usage: SubscriptionUsageResponse;
};

function safePercent(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  const pct = (used / total) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatHoursMinutes(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function indicatorColorFor(percent: number): string {
  if (percent >= 95) return 'bg-red-500';
  if (percent >= 80) return 'bg-amber-500';
  return 'bg-primary';
}

export function UsageMeters({ usage }: Props) {
  const chatbotPct = safePercent(usage.chatbot.used, usage.chatbot.quota);
  const minutesPct = safePercent(usage.minutes.used_seconds, usage.minutes.balance_seconds);

  return (
    <View className="rounded-2xl border border-border bg-card p-5 gap-5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-bold text-foreground">Uso del periodo en curso</Text>
        <Text className="text-xs text-muted-foreground">
          Reseteo: {formatDate(usage.period_ends_at)}
        </Text>
      </View>

      {/* Chatbot */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={Bot} size={16} className="text-foreground" />
            <Text className="text-sm font-semibold text-foreground">Chatbot</Text>
          </View>
          <Text className="text-sm font-medium text-foreground">
            {usage.chatbot.used}
            <Text className="text-xs text-muted-foreground">
              {' '}/ {usage.chatbot.quota} mensajes
            </Text>
          </Text>
        </View>
        <Progress
          value={chatbotPct}
          className="h-2 bg-primary/15"
          indicatorClassName={cn(indicatorColorFor(chatbotPct))}
        />
        <Text className="text-xs text-muted-foreground">
          Te quedan {usage.chatbot.remaining} mensaje{usage.chatbot.remaining === 1 ? '' : 's'}.
        </Text>
      </View>

      {/* Actas */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={FileText} size={16} className="text-foreground" />
            <Text className="text-sm font-semibold text-foreground">Actas (transcripción)</Text>
          </View>
          <Text className="text-sm font-medium text-foreground">
            {formatHoursMinutes(usage.minutes.used_seconds)}
            <Text className="text-xs text-muted-foreground">
              {' '}/ {formatHoursMinutes(usage.minutes.balance_seconds)}
            </Text>
          </Text>
        </View>
        <Progress
          value={minutesPct}
          className="h-2 bg-primary/15"
          indicatorClassName={cn(indicatorColorFor(minutesPct))}
        />
        <Text className="text-xs text-muted-foreground">
          Te quedan {formatHoursMinutes(usage.minutes.remaining_seconds)} disponibles ·
          tope acumulable: {formatHoursMinutes(usage.minutes.cap_seconds)}.
        </Text>
      </View>
    </View>
  );
}
