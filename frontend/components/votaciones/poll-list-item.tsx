import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Scale, ChevronRight } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { PollReadResponse, PollCurrentStatus } from '@/types/poll.types';
import { cn } from '@/lib/utils';

interface PollListItemProps {
  poll: PollReadResponse;
  onPress: () => void;
}

const statusConfig: Record<
  PollCurrentStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: 'Borrador',
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  PENDING: {
    label: 'Pendiente',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
    border: 'border-yellow-500/20',
  },
  ACTIVE: {
    label: 'Activa',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    border: 'border-green-500/20',
  },
  WAITING_ABSENTEES: {
    label: 'Esperando ausentes',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600',
    border: 'border-orange-500/20',
  },
  FINISHED: {
    label: 'Finalizada',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-500/20',
  },
  CANCELLED: {
    label: 'Cancelada',
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    border: 'border-red-500/20',
  },
  UNKNOWN: {
    label: 'Desconocido',
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
};

export function PollListItem({ poll, onPress }: PollListItemProps) {
  const config = statusConfig[poll.current_status];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-2">
      <Card className="border-border">
        <CardContent className="p-3">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0 border border-primary/20">
              <Icon as={Scale} size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-0.5">
                <Text className="font-bold text-base text-foreground flex-1 pr-2" numberOfLines={1}>
                  {poll.title}
                </Text>
                <Text className="text-[10px] font-medium text-muted-foreground">
                  {new Date(poll.created_at).toLocaleDateString('es-ES')}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {poll.description || 'Sin descripción'}
              </Text>
              <View className="flex-row items-center justify-between mt-1.5">
                <View className="flex-row items-center gap-2">
                  <View
                    className={cn(
                      'rounded-md px-2 py-0.5 border',
                      config.bg,
                      config.border
                    )}>
                    <Text className={cn('text-[10px] font-bold uppercase', config.text)}>
                      {config.label}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-muted-foreground">•</Text>
                  <Text className="text-[10px] font-semibold text-primary/80">
                    {poll.options.length} opciones
                  </Text>
                </View>
                <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}
