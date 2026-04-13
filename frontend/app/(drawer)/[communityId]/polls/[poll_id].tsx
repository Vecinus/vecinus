import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { pollsApi } from '@/api/polls';
import { VoteForm } from '@/components/polls/VoteForm';
import { PollEmailAuth } from '@/components/polls/PollEmailAuth';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft } from 'lucide-react-native';
import { Poll } from '@/types/polls.types';

export default function VoteScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, activeCommunity } = useAuth();

  const poll_id = params?.poll_id as string;

  const [authStep, setAuthStep] = useState<'check' | 'auth' | 'vote'>('check');
  const [coefficient, setCoefficient] = useState<number>(0);
  const [isDefaulter, setIsDefaulter] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingToken, setVotingToken] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const [poll, setPoll] = useState<Poll | null>(null);
  const [isPollLoading, setIsPollLoading] = useState(true);
  const [pollError, setPollError] = useState<boolean>(false);
  const [isVoting, setIsVoting] = useState(false);

  const associationId = activeCommunity ? activeCommunity.id : '';
  const navigation = useNavigation();

  const fetchData = useCallback(async () => {
    if (!poll_id || !user?.id) return;

    try {
      setIsPollLoading(true);
      setPollError(false);
      setVoteError(null);

      const [pollData, membershipData, voteCheckData] = await Promise.all([
        pollsApi.fetchPollById(poll_id),
        pollsApi.fetchMembershipInfo(poll_id).catch((e) => {
          if (e.response?.status === 403) return { is_defaulter: true, coefficient: 0 };
          throw e;
        }),
        pollsApi.checkUserHasVoted(poll_id)
      ]);

      setPoll(pollData);
      setCoefficient(membershipData.coefficient || 0);
      setIsDefaulter(membershipData.is_defaulter || false);
      setHasVoted(voteCheckData.has_voted || false);

      if (voteCheckData.has_voted) {
        setAuthStep('vote');
      } else if (membershipData.is_defaulter) {
        setAuthStep('vote');
      } else {
        setAuthStep('auth');
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setPollError(true);
    } finally {
      setIsPollLoading(false);
    }
  }, [poll_id, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push(`/${associationId}/polls` as any)}
          className="ml-2 mr-4 p-1">
          <ChevronLeft size={26} className="text-foreground" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, associationId]);

  const handleTokenObtained = (token: string) => {
    setVotingToken(token);
    setAuthStep('vote');
  };

  const handleVoteSubmit = async (selectedOption: string, optionIndex: number) => {
    if (!poll_id) {
      setVoteError('ID de votación inválido');
      return;
    }

    if (!votingToken) {
      setVoteError('Falta el token de votación');
      return;
    }

    try {
      setIsVoting(true);
      setVoteError(null);

      const voteData: any = {
        selected_option: selectedOption,
        voting_token: votingToken,
        rgpd_accepted: true,
      };

      await pollsApi.castVote(poll_id, voteData);

      setHasVoted(true);

      setTimeout(() => {
        router.push(`/${activeCommunity?.id}/polls/results/${poll_id}` as any);
      }, 1500);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setVoteError(
          'No puedes ejercer el derecho a voto por deudas pendientes con la comunidad (Art. 15.2 LPH)'
        );
      } else if (error.response?.status === 404) {
        setVoteError('Token de votación inválido o expirado');
      } else if (error.response?.status === 400) {
        setVoteError(error.response?.data?.detail || 'Error al registrar el voto');
      } else {
        setVoteError('Error al registrar el voto. Intenta de nuevo.');
      }
    } finally {
      setIsVoting(false);
    }
  };

  if (pollError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 bg-background p-4">
          <View className="overflow-hidden rounded-lg border border-red-200 bg-red-50">
            <Alert
              icon={AlertCircle}
              className="border-0 bg-transparent"
              iconClassName="text-red-800">
              <AlertTitle className="font-bold text-red-800">Votación no encontrada</AlertTitle>
              <AlertDescription className="mt-1 text-sm text-red-700">
                No se pudo cargar la información de la votación
              </AlertDescription>
            </Alert>
          </View>
        </View>
      </>
    );
  }

  if (isPollLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cargando...' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" className="mb-4 text-primary" />
          <Text className="text-muted-foreground">Cargando votación...</Text>
        </View>
      </>
    );
  }

  if (!poll) {
    return (
      <>
        <Stack.Screen options={{ title: 'No disponible' }} />
        <View className="flex-1 items-center justify-center bg-background px-4">
          <Text className="font-semibold text-foreground">Votación no disponible</Text>
          <Text className="mt-2 text-center text-muted-foreground">
            La votación que intentas acceder no existe
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: poll.title,
          headerShown: true,
        }}
      />
      <View className="flex-1 bg-background">
        {hasVoted ? (
          <ScrollView className="flex-1 p-4">
            <View className="mb-4 overflow-hidden rounded-lg border border-green-200 bg-green-50">
              <Alert
                icon={AlertCircle}
                className="border-0 bg-transparent"
                iconClassName="text-green-800">
                <AlertTitle className="font-bold text-green-800">Ya has votado</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-green-700">
                  Tu voto ha sido registrado. Puedes ver los resultados de la votación a
                  continuación.
                </AlertDescription>
              </Alert>
            </View>
            <Pressable
              onPress={() => router.push(`/${activeCommunity?.id}/polls/results/${poll_id}` as any)}
              className="items-center rounded-lg bg-blue-600 p-4">
              <Text className="font-semibold text-white">Ver resultados</Text>
            </Pressable>
          </ScrollView>
        ) : isDefaulter ? (
          <ScrollView className="flex-1 p-4">
            <View className="overflow-hidden rounded-lg border border-red-200 bg-red-50">
              <Alert
                icon={AlertCircle}
                className="border-0 bg-transparent"
                iconClassName="text-red-800">
                <AlertTitle className="font-bold text-red-800">No tienes derecho a voto</AlertTitle>
                <AlertDescription className="mt-1 text-sm text-red-700">
                  Según el Art. 15.2 de la Ley de Propiedad Horizontal, no puedes ejercer el derecho
                  a voto por deudas pendientes con la comunidad. Sin embargo, puedes ver los
                  resultados finales.
                </AlertDescription>
              </Alert>
            </View>
          </ScrollView>
        ) : authStep === 'auth' && !votingToken ? (
          <PollEmailAuth
            pollId={poll_id}
            userEmail={user?.email || ''}
            onTokenObtained={handleTokenObtained}
            onCancel={() => router.push(`/${associationId}/polls` as any)}
          />
        ) : (
          <VoteForm
            poll={poll}
            coefficient={coefficient}
            onSubmit={handleVoteSubmit}
            isLoading={isVoting}
            error={voteError}
            isDefaulter={isDefaulter}
          />
        )}
      </View>
    </>
  );
}