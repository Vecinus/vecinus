import React, { useState, useCallback, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { pollsApi } from '@/api/polls';
import { Text } from '@/components/ui/text';
import { PollCard } from '@/components/polls/PollCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Poll } from '@/types/polls.types';
import { AlertCircle } from 'lucide-react-native';

export default function PollsScreen() {
  const router = useRouter();
  const role = useRole();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  // 1. Añadimos los estados necesarios para la data, carga y errores
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 1 || role === 4;

  // 2. Creamos la función asíncrona para obtener los datos
  const fetchPollsData = useCallback(async () => {
    if (!associationId) return;

    try {
      setError(false);
      const data = await pollsApi.fetchPolls(associationId);
      setPolls(data);
    } catch (err) {
      console.error("Error al obtener votaciones:", err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [associationId]);

  // 3. Ejecutamos la función cuando el componente se monta o cambia el associationId
  useEffect(() => {
    fetchPollsData();
  }, [fetchPollsData]);

  // 4. Arreglamos la función de refresco
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPollsData();
    setRefreshing(false);
  }, [fetchPollsData]);

  const filteredPolls = isAdmin ? polls : polls.filter((poll: Poll) => poll.status !== 'DRAFT');

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
                onPress={() => router.push(`/${associationId}/polls/create` as any)}
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

        {/* Opcional: Mostrar un indicador de carga inicial */}
        {isLoading && !refreshing ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        ) : (
          <FlatList
            data={filteredPolls}
            renderItem={({ item }) => (
              <View className="mt-4 px-4">
                <PollCard
                  poll={item}
                  isAdmin={isAdmin}
                  onPress={() => router.push(`/${associationId}/polls/${item.id}` as any)}
                  onEditPress={() => router.push(`/${associationId}/polls/${item.id}/edit` as any)}
                  onResultsPress={() => router.push(`/${associationId}/polls/results/${item.id}` as any)}
                />
              </View>
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </>
  );
}