import React, { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { usePolls, useDeletePollMutation } from '@/hooks/usePolls';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PollCard } from '@/components/polls/PollCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Poll } from '@/types/polls.types';
import { AlertCircle } from 'lucide-react-native';

function CustomAlertDeleteDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
          <Text className="mb-2 text-lg font-bold text-foreground">{title}</Text>
          <Text className="mb-6 text-muted-foreground">{message}</Text>
          <View className="flex-row justify-end gap-3">
            <Button variant="outline" onPress={onCancel} disabled={isLoading}>
              <Text>Cancelar</Text>
            </Button>
            <Button variant="destructive" onPress={onConfirm} disabled={isLoading}>
              <Text className="text-destructive-foreground">
                {isLoading ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PollsScreen() {
  const router = useRouter();
  const role = useRole();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const [refreshing, setRefreshing] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

  const isAdmin = role === 1 || role === 4;

  const { data: polls = [], isLoading: isListLoading, error, refetch } = usePolls(associationId);
  const deletePolMutation = useDeletePollMutation(associationId);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDeletePoll = async () => {
    if (!pollToDelete) return;
    try {
      await deletePolMutation.mutateAsync(pollToDelete.id);
      setPollToDelete(null);
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="mb-2 text-lg font-semibold text-foreground">Sin votaciones</Text>
      <Text className="text-center text-sm text-muted-foreground">
        {isAdmin
          ? 'Crea una nueva votación para comenzar'
          : 'No hay votaciones disponibles en este momento'}
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Votaciones',
          headerRight: isAdmin
            ? () => (
                <TouchableOpacity
                  onPress={() => router.push(`/${associationId}/polls/create`)}
                  className="mr-4 rounded bg-primary px-3 py-2">
                  <Text className="text-sm font-semibold text-white">+ Nueva</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <View className="flex-1 bg-background">
        <CustomAlertDeleteDialog
          visible={!!pollToDelete}
          title="Eliminar votación"
          message={`¿Estás seguro de que deseas eliminar "${pollToDelete?.title}"? Esta acción no se puede deshacer.`}
          onCancel={() => setPollToDelete(null)}
          onConfirm={handleDeletePoll}
          isLoading={deletePolMutation.isPending}
        />

        {error && (
          <View className="p-4">
            <Alert icon={AlertCircle} variant="destructive">
              <AlertTitle className="font-bold">Error</AlertTitle>
              <AlertDescription>No se pudieron cargar las votaciones</AlertDescription>
            </Alert>
          </View>
        )}

        <FlatList
          data={polls}
          renderItem={({ item }) => (
            <View className="mt-4 px-4">
              <PollCard
                poll={item}
                isAdmin={isAdmin}
                onPress={() => router.push(`/${associationId}/polls/${item.id}`)}
                onEditPress={() => router.push(`/${associationId}/polls/${item.id}/edit`)}
                onDeletePress={() => setPollToDelete(item)}
                onResultsPress={() => router.push(`/${associationId}/polls/results/${item.id}`)}
                onMarkAbsentPress={() =>
                  router.push(`/${associationId}/polls/${item.id}/mark-absent`)
                }
              />
            </View>
          )}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </>
  );
}
