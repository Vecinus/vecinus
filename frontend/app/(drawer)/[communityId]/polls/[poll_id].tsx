import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePollById, useCastVoteMutation } from '@/hooks/usePolls';
import { useDeepLink } from '@/hooks/useDeepLink';
import { VoteForm } from '@/components/polls/VoteForm';
import { Text } from '@/components/ui/text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { VoteCreate } from '@/types/polls.types';
import { CircleAlertIcon } from 'lucide-react-native';

export default function VoteScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, activeCommunity } = useAuth();

  const poll_id = params?.poll_id as string;
  let voting_token = params?.token as string;

  const { voteToken: deepLinkToken, pollId: deepLinkPollId, error: deepLinkError } = useDeepLink();

  if (!voting_token && deepLinkToken) {
    voting_token = deepLinkToken;
  }

  const [coefficient, setCoefficient] = useState<number>(0);
  const [isDefaulter, setIsDefaulter] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isLoadingMembership, setIsLoadingMembership] = useState(true);

  const { data: poll, isLoading: isPollLoading, error: pollError } = usePollById(poll_id);
  const { mutateAsync: castVote, isPending: isVoting } = useCastVoteMutation(poll_id);

  useEffect(() => {
    fetchMembershipData();
  }, [user?.id, poll_id]);

  const fetchMembershipData = async () => {
    try {
      setIsLoadingMembership(true);
      const response = await fetch(`/api/polls/${poll_id}/membership-info`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setIsDefaulter(true);
        } else {
          throw new Error('Failed to load membership info');
        }
      } else {
        const data = await response.json();
        setCoefficient(data.coefficient || 0);
        setIsDefaulter(data.is_defaulter || false);
      }
    } catch (err) {
      console.error('Error fetching membership:', err);
      setVoteError('No se pudo cargar tu información de membresía');
    } finally {
      setIsLoadingMembership(false);
    }
  };

  const handleVoteSubmit = async (selectedOption: string) => {
    if (!voting_token || !poll_id) {
      setVoteError('Token o ID de votación inválido');
      return;
    }

    try {
      setVoteError(null);
      const voteData: VoteCreate = {
        selected_option: selectedOption,
        voting_token: voting_token,
        rgpd_accepted: true,
      };

      await castVote(voteData);

      setTimeout(() => {
        router.push(`/${activeCommunity?.id}/polls/results/${poll_id}`);
      }, 1500);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setVoteError(
          'No puedes ejercer el derecho a voto por deudas pendientes con la comunidad (Art. 15.2 LPH)'
        );
      } else if (error.response?.status === 404) {
        setVoteError('Enlace de votación inválido o expirado');
      } else if (error.response?.status === 400) {
        setVoteError(error.response?.data?.detail || 'Error al registrar el voto');
      } else {
        setVoteError('Error al registrar el voto. Intenta de nuevo.');
      }
    }
  };

  const isLoading = isPollLoading || isLoadingMembership;

  if (deepLinkError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 bg-background">
          <Alert icon={CircleAlertIcon} className="m-4 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Enlace Inválido</AlertTitle>
            <AlertDescription className="mt-2 text-sm text-red-700">
              {deepLinkError}
            </AlertDescription>
          </Alert>
        </View>
      </>
    );
  }

  if (pollError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View className="flex-1 bg-background">
          <Alert icon={CircleAlertIcon} className="m-4 border-red-500 bg-red-50">
            <AlertTitle className="font-bold text-red-800">Votación no encontrada</AlertTitle>
            <AlertDescription className="mt-2 text-sm text-red-700">
              No se pudo cargar la información de la votación
            </AlertDescription>
          </Alert>
        </View>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cargando...' }} />
        <View className="flex-1 items-center justify-center bg-background">
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
        {isDefaulter ? (
          <ScrollView className="flex-1">
            <View className="p-4">
              <Alert icon={CircleAlertIcon} className="mb-4 border-red-500 bg-red-50">
                <AlertTitle className="text-base font-bold text-red-800">
                  No tienes derecho a voto
                </AlertTitle>
                <AlertDescription className="mt-2 text-sm text-red-700">
                  Según el Art. 15.2 de la Ley de Propiedad Horizontal, no puedes ejercer el derecho
                  a voto por deudas pendientes con la comunidad. Sin embargo, puedes ver los
                  resultados finales.
                </AlertDescription>
              </Alert>
            </View>
          </ScrollView>
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
