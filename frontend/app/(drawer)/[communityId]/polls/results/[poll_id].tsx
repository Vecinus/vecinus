import React, { useEffect, useState, useCallback } from 'react';
import { View, Alert as RNAlert, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams, useNavigation, Stack, useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { pollsApi } from '@/api/polls';
import { ResultsView } from '@/components/polls/ResultsView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CustomAlertDialog } from '@/components/custom-alert';
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
  const [isClosing, setIsClosing] = useState(false);
  const [pollStatus, setPollStatus] = useState<string>('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const role = useRole();
  const isAdmin = role === 1 || role === 4;
  const navigation = useNavigation();

  const handleManualClose = () => {
    setShowCloseConfirm(true);
  };

  const confirmManualClose = async () => {
    setIsClosing(true);
    setShowCloseConfirm(false);

    try {
      await pollsApi.closePoll(poll_id);
      RNAlert.alert('Éxito', 'Votación cerrada manualmente', [
        {
          text: 'OK',
          onPress: () => router.push(`/${associationId}/polls` as any),
        },
      ]);
      router.push(`/${associationId}/polls`);
    } catch (error: any) {
      RNAlert.alert('Error', error.response?.data?.detail || 'No se pudo cerrar la votación');
    } finally {
      setIsClosing(false);
    }
  };

  const fetchResults = useCallback(async () => {
    if (!associationId || !poll_id) return;
    try {
      setIsLoading(true);
      setError(false);
      const [resultsData, pollData] = await Promise.all([
        pollsApi.fetchPollResults(associationId, poll_id),
        pollsApi.fetchPollById(poll_id),
      ]);
      setResults(resultsData);
      setPollStatus(pollData.current_status || '');
    } catch (err) {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [associationId, poll_id]);

  useFocusEffect(
    useCallback(() => {
      fetchResults();
    }, [fetchResults])
  );

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
  }, [navigation, associationId]);

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
      <CustomAlertDialog
        config={{
          visible: showCloseConfirm,
          title: 'Cerrar Votación',
          message:
            '¿Estás seguro de que deseas cerrar esta votación manualmente? Esta acción no se puede deshacer.',
          type: 'confirm',
        }}
        onConfirm={confirmManualClose}
        onCancel={() => setShowCloseConfirm(false)}
        onAcknowledge={() => {}}
        isLoading={isClosing}
      />
      <View className="flex-1 bg-background">
        <ResultsView results={results} />
        {isAdmin && pollStatus === 'ACTIVE' && (
          <View className="border-t border-border bg-card p-4">
            <Button onPress={handleManualClose} disabled={isClosing} className="w-full bg-red-600">
              <Text className="font-semibold text-white">
                {isClosing ? 'Cerrando...' : 'Cerrar Votación Manualmente'}
              </Text>
            </Button>
          </View>
        )}
      </View>
    </>
  );
}
