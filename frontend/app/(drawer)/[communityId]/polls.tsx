import React, { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { usePolls } from '@/hooks/usePolls';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PollCard } from '@/components/polls/PollCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Poll } from '@/types/polls.types';
import { AlertCircle } from 'lucide-react-native';

export default function PollsScreen() {
  const router = useRouter();
  const role = useRole();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 1 || role === 4;

  const { data: polls = [], isLoading: isListLoading, error, refetch } = usePolls(associationId);

  const filteredPolls = isAdmin ? polls : polls.filter((poll) => poll.status !== 'DRAFT');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
          <View className="p-4">
            <Alert icon={AlertCircle} variant="destructive">
              <AlertTitle className="font-bold">Error</AlertTitle>
              <AlertDescription>No se pudieron cargar las votaciones</AlertDescription>
            </Alert>
          </View>
        )}

        <FlatList
          data={filteredPolls}
          renderItem={({ item }) => (
            <View className="mt-4 px-4">
              <PollCard
                poll={item}
                isAdmin={isAdmin}
                onPress={() => router.push(`/${associationId}/polls/${item.id}`)}
                onEditPress={() => router.push(`/${associationId}/polls/${item.id}/edit`)}
                onResultsPress={() => router.push(`/${associationId}/polls/results/${item.id}`)}
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
