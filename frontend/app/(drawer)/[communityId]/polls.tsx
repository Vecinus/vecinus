import React, { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { usePolls, useDeletePollMutation } from '@/hooks/usePolls';
import { Text } from '@/components/ui/text';
import { PollCard } from '@/components/polls/PollCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Poll } from '@/types/polls.types';
import { CircleAlertIcon } from 'lucide-react-native';

export default function PollsScreen() {
  const router = useRouter();
  const role = useRole();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);

  const isAdmin = role === 1 || role === 4;

  const { data: polls = [], isLoading, error, refetch } = usePolls(associationId);

  const deletePolMutation = useDeletePollMutation(associationId, selectedPoll?.id || '');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleVotePoll = (poll: Poll) => {
    router.push(`/${associationId}/polls/${poll.id}`);
  };

  const handleEditPoll = (poll: Poll) => {
    router.push(`/${associationId}/polls/${poll.id}/edit`);
  };

  const handleDeletePoll = async (poll: Poll) => {
    try {
      await deletePolMutation.mutateAsync();
      setSelectedPoll(null);
    } catch (err) {
      console.error('Error deleting poll:', err);
    }
  };

  const handleViewResults = (poll: Poll) => {
    router.push(`/${associationId}/polls/results/${poll.id}`);
  };

  const handleMarkAbsent = (poll: Poll) => {
    router.push(`/${associationId}/polls/${poll.id}/mark-absent`);
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
        {error && (
          <Alert icon={CircleAlertIcon} className="mx-4 mt-4 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Error</AlertTitle>
            <AlertDescription className="mt-1 text-sm text-red-700">
              No se pudieron cargar las votaciones
            </AlertDescription>
          </Alert>
        )}

        <FlatList
          data={polls}
          renderItem={({ item }) => (
            <View className="mt-4 px-4">
              <PollCard
                poll={item}
                isAdmin={isAdmin}
                onPress={() => handleVotePoll(item)}
                onEditPress={() => handleEditPoll(item)}
                onDeletePress={() => handleDeletePoll(item)}
                onResultsPress={() => handleViewResults(item)}
                onMarkAbsentPress={() => handleMarkAbsent(item)}
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
