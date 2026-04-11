import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { Poll, PollCurrentStatus } from '@/types/polls.types';

interface PollCardProps {
  poll: Poll;
  onPress?: () => void;
  isAdmin?: boolean;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  onResultsPress?: () => void;
  onMarkAbsentPress?: () => void;
}

const getStatusColor = (status: PollCurrentStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500';
    case 'PENDING':
      return 'bg-gray-400';
    case 'WAITING_ABSENTEES':
      return 'bg-orange-400';
    case 'FINISHED':
      return 'bg-gray-600';
    case 'DRAFT':
      return 'bg-blue-400';
    default:
      return 'bg-gray-400';
  }
};

const getStatusLabel = (status: PollCurrentStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'En Curso';
    case 'PENDING':
      return 'Próxima';
    case 'WAITING_ABSENTEES':
      return 'Recuento Ausentes';
    case 'FINISHED':
      return 'Finalizada';
    case 'DRAFT':
      return 'Borrador';
    default:
      return 'Desconocido';
  }
};

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  onPress,
  isAdmin,
  onEditPress,
  onDeletePress,
  onResultsPress,
  onMarkAbsentPress,
}) => {
  const currentStatus = poll.current_status || 'UNKNOWN';
  const statusColor = getStatusColor(currentStatus as PollCurrentStatus);
  const statusLabel = getStatusLabel(currentStatus as PollCurrentStatus);

  const endDate = poll.end_at
    ? new Date(poll.end_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';

  const handleCardPress = () => {
    if (isAdmin) return;

    if (currentStatus === 'ACTIVE' && onPress) {
      onPress();
    } else if (
      (currentStatus === 'FINISHED' || currentStatus === 'WAITING_ABSENTEES') &&
      onResultsPress
    ) {
      onResultsPress();
    }
  };

  return (
    <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7} className="mb-4">
      <Card className="rounded-lg border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <View className="flex-row items-center justify-between">
            <CardTitle className="flex-1 pr-2 text-lg font-semibold text-foreground">
              <Text>{poll.title}</Text>
            </CardTitle>
            <Badge className={`${statusColor} rounded-full px-3 py-1`}>
              <Text className="text-xs font-medium text-white">{statusLabel}</Text>
            </Badge>
          </View>
        </CardHeader>

        <CardContent className="space-y-2">
          {poll.description ? (
            <Text className="line-clamp-2 text-sm text-muted-foreground">{poll.description}</Text>
          ) : null}

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              Cierra: <Text className="font-semibold text-foreground">{endDate}</Text>
            </Text>
            <Text className="text-xs text-muted-foreground">
              {poll.options?.length || 0} opciones
            </Text>
          </View>

          {isAdmin ? (
            <View className="mt-4 flex-row justify-end gap-2">
              {currentStatus === 'DRAFT' ? (
                <>
                  <TouchableOpacity onPress={onEditPress} className="rounded bg-blue-500 px-3 py-2">
                    <Text className="text-xs font-semibold text-white">Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onDeletePress}
                    className="rounded bg-red-500 px-3 py-2">
                    <Text className="text-xs font-semibold text-white">Borrar</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {currentStatus === 'WAITING_ABSENTEES' ? (
                <TouchableOpacity
                  onPress={onMarkAbsentPress}
                  className="rounded bg-orange-500 px-3 py-2">
                  <Text className="text-xs font-semibold text-white">Marcar Ausentes</Text>
                </TouchableOpacity>
              ) : null}

              {currentStatus === 'FINISHED' || currentStatus === 'WAITING_ABSENTEES' ? (
                <TouchableOpacity
                  onPress={onResultsPress}
                  className="rounded bg-green-500 px-3 py-2">
                  <Text className="text-xs font-semibold text-white">Resultados</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
};

export default PollCard;
