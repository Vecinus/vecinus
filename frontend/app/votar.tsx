import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Scale, CheckCircle2, XCircle, Shield, AlertCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { pollService } from '@/api/services/poll.service';
import { PollReadResponse } from '@/types/poll.types';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';

const RGPD_TEXT = `De conformidad con la Ley de Propiedad Horizontal (LPH) y el Reglamento General de Protección de Datos (RGPD), se informa que:

1. El voto es nominal y vinculado a su propiedad para cumplir con los requisitos de la LPH (Art. 15 y 17), que exige el registro de las cuotas de participación y la identidad de los votantes para el cálculo de la doble mayoría.

2. Sus datos personales (nombre, propiedad y voto) serán tratados exclusivamente para la gestión de esta votación y la generación del acta correspondiente.

3. El tratamiento es necesario para el cumplimiento de obligaciones legales (Art. 6.1.c RGPD) y el ejercicio de derechos legales (Art. 6.1.e RGPD).

4. Los datos serán conservados durante el plazo legalmente establecido y solo serán accesibles por el administrador de la comunidad y las autoridades competentes.

Al marcar esta casilla, acepta el tratamiento de sus datos conforme a lo descrito y confirma que su voto se emitirá de forma nominal según lo establecido en la LPH.`;

export default function VoteScreen() {
  const { token, poll_id } = useLocalSearchParams<{ token?: string; poll_id?: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const [poll, setPoll] = useState<PollReadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogTitle, setDialogTitle] = useState('');

  useEffect(() => {
    const loadPoll = async () => {
      if (!poll_id || !token) {
        setError('Enlace de votación inválido. Falta el token o el identificador de la votación.');
        setLoading(false);
        return;
      }

      try {
        const pollData = await pollService.getPoll(poll_id);
        setPoll(pollData);

        if (pollData.current_status !== 'ACTIVE') {
          setError(
            pollData.current_status === 'FINISHED'
              ? 'Esta votación ya ha finalizado.'
              : pollData.current_status === 'PENDING'
                ? 'Esta votación aún no ha comenzado.'
                : pollData.current_status === 'DRAFT'
                  ? 'Esta votación aún no ha sido publicada.'
                  : 'Esta votación no está disponible para votar.'
          );
        }
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setError(detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : 'No se pudo cargar la votación.');
      } finally {
        setLoading(false);
      }
    };

    loadPoll();
  }, [poll_id, token]);

  const handleVote = async () => {
    if (!poll_id || !token || !selectedOption || !rgpdAccepted) return;

    setIsSubmitting(true);
    try {
      await pollService.submitVote(poll_id, token, selectedOption, rgpdAccepted);
      setVoteSuccess(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setDialogTitle('Error al votar');
      setDialogMessage(
        detail
          ? typeof detail === 'string'
            ? detail
            : JSON.stringify(detail)
          : 'No se pudo registrar su voto. Inténtelo de nuevo.'
      );
      setDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="mt-4 text-muted-foreground">Verificando enlace de votación...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <View className="w-16 h-16 rounded-full bg-destructive/10 items-center justify-center mb-4">
          <Icon as={XCircle} size={32} className="text-destructive" />
        </View>
        <Text className="text-xl font-bold text-foreground text-center mb-2">
          Votación no disponible
        </Text>
        <Text className="text-center text-muted-foreground">{error}</Text>
        <Button className="mt-6" onPress={() => router.replace('/' as any)}>
          <Text>Volver al inicio</Text>
        </Button>
      </View>
    );
  }

  if (voteSuccess) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <View className="w-16 h-16 rounded-full bg-green-500/10 items-center justify-center mb-4">
          <Icon as={CheckCircle2} size={32} className="text-green-600" />
        </View>
        <Text className="text-xl font-bold text-foreground text-center mb-2">
          Voto registrado
        </Text>
        <Text className="text-center text-muted-foreground">
          Su voto ha sido registrado correctamente. Gracias por participar.
        </Text>
      </View>
    );
  }

  if (!poll) return null;

  const canVote = poll.current_status === 'ACTIVE';

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="items-center mb-6 mt-4">
          <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-3 border border-primary/20">
            <Icon as={Scale} size={28} className="text-primary" />
          </View>
          <Text className="text-2xl font-bold text-foreground text-center">
            {poll.title}
          </Text>
          {poll.description ? (
            <Text className="text-sm text-muted-foreground text-center mt-2 px-4">
              {poll.description}
            </Text>
          ) : null}
        </View>

        {canVote ? (
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Seleccione su voto</Text>
            <View className="gap-3">
              {poll.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setSelectedOption(option)}
                  activeOpacity={0.7}>
                  <Card
                    className={selectedOption === option ? 'border-primary border-2' : 'border-border'}>
                    <CardContent className="p-4 flex-row items-center gap-3">
                      <View
                        className={cn(
                          'w-5 h-5 rounded-full border-2 items-center justify-center',
                          selectedOption === option
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}>
                        {selectedOption === option && (
                          <View className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </View>
                      <Text
                        className={cn(
                          'text-base font-medium flex-1',
                          selectedOption === option ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                        {option}
                      </Text>
                    </CardContent>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>

            <Card className="border-yellow-500/30 bg-yellow-500/5 mt-4">
              <CardContent className="p-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Icon as={Shield} size={18} className="text-yellow-600" />
                  <Text className="text-sm font-bold text-yellow-600">
                    Privacidad y RGPD - Votación Nominal (LPH)
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground leading-5">
                  {RGPD_TEXT}
                </Text>
              </CardContent>
            </Card>

            <View className="flex-row items-start gap-3 mt-2 px-1">
              <Checkbox
                checked={rgpdAccepted}
                onCheckedChange={(checked) => setRgpdAccepted(checked as boolean)}
              />
              <TouchableOpacity
                onPress={() => setRgpdAccepted(!rgpdAccepted)}
                activeOpacity={0.7}
                className="flex-1">
                <Text className="text-sm text-foreground leading-5">
                  He leído y acepto el tratamiento de mis datos personales conforme a la normativa RGPD y la Ley de Propiedad Horizontal.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Card className="border-destructive/30 bg-destructive/5 mt-4">
            <CardContent className="p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Icon as={AlertCircle} size={18} className="text-destructive" />
                <Text className="text-sm font-bold text-destructive">Votación no disponible</Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                Esta votación no se encuentra en estado activo. No es posible emitir un voto en este momento.
              </Text>
            </CardContent>
          </Card>
        )}
      </ScrollView>

      {canVote && (
        <View className="border-t border-border bg-background px-4 pb-6 pt-4">
          <Button
            className="h-14 w-full gap-2 rounded-xl"
            onPress={handleVote}
            disabled={!selectedOption || !rgpdAccepted || isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Icon as={CheckCircle2} size={20} className="text-primary-foreground" />
                <Text className="text-base font-bold text-primary-foreground">
                  Confirmar voto
                </Text>
              </>
            )}
          </Button>
          {(!selectedOption || !rgpdAccepted) && (
            <Text className="text-xs text-muted-foreground text-center mt-2">
              {!selectedOption
                ? 'Seleccione una opción para votar'
                : 'Debe aceptar la cláusula de privacidad para poder votar'}
            </Text>
          )}
        </View>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setDialogOpen(false)}>
              <Text>Entendido</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

function cn(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(' ');
}