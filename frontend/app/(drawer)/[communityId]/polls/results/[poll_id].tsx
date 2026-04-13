import React, { useEffect, useState, useCallback } from 'react';
import { View, Alert as RNAlert, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams, useNavigation, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { pollsApi } from '@/api/polls';
import { ResultsView } from '@/components/polls/ResultsView';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChevronLeft, CircleAlertIcon } from 'lucide-react-native';
import { PollResults } from '@/types/polls.types';

export default function PollResultsScreen() {
  const params = useLocalSearchParams();
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const poll_id = params?.poll_id as string;

  const [results, setResults] = useState<PollResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const navigation = useNavigation();

  const fetchResults = useCallback(async () => {
    if (!associationId || !poll_id) return;
    try {
      setIsLoading(true);
      setError(false);
      const data = await pollsApi.fetchPollResults(associationId, poll_id);
      setResults(data);
    } catch (err) {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [associationId, poll_id]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/polls`)}
          className="ml-2 mr-4 p-1">
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Resultados' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" className="mb-4 text-primary" />
          <Text className="text-muted-foreground">Cargando resultados...</Text>
        </View>
      </>
    );
  }

  if (error || !results) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 bg-background">
          <Alert icon={CircleAlertIcon} className="m-4 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Error al cargar</AlertTitle>
            <AlertDescription className="mt-1 text-sm text-red-700">
              No se pudieron cargar los resultados de la votación
            </AlertDescription>
          </Alert>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Resultados de la Votación',
          headerShown: true,
        }}
      />
      <View className="flex-1 bg-background">
        <ResultsView
          results={results}
        />
      </View>
    </>
  );
}