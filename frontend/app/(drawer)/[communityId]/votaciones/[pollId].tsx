import React, { useState, useEffect } from 'react';
import { isAxiosError } from 'axios';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  CheckCircle2,
  Scale,
  ChevronLeft,
  XCircle,
  PieChart,
  Lock,
  UserCheck,
  Send,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { pollService } from '@/api/services/poll.service';
import { storageService } from '@/api/services/storage.service';
import {
  PollReadResponse,
  PollResultResponse,
  MembershipInfoResponse,
  HasVotedResponse,
} from '@/types/poll.types';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { isAdminOrPresident } from '@/utils/role.util';
import { cn } from '@/lib/utils';

export default function PollDetail() {
  const { communityId, pollId } = useLocalSearchParams<{
    communityId: string;
    pollId: string;
  }>();
  const router = useRouter();
  const [poll, setPoll] = useState<PollReadResponse | null>(null);
  const [results, setResults] = useState<PollResultResponse | null>(null);
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfoResponse | null>(null);
  const [hasVoted, setHasVoted] = useState<HasVotedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCommunity, setActiveCommunity] = useState<any>(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishDates, setPublishDates] = useState(() => {
    const start = new Date();
    start.setSeconds(0, 0);
    const nextWeek = new Date(start);
    nextWeek.setDate(start.getDate() + 7);
    nextWeek.setHours(18, 0, 0, 0);
    const absentees = new Date(nextWeek);
    absentees.setDate(absentees.getDate() + 2);
    absentees.setHours(18, 0, 0, 0);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

    return {
      startDate: fmt(start),
      startTime: fmtTime(start),
      endDate: fmt(nextWeek),
      endTime: fmtTime(nextWeek),
      absenteesDate: fmt(absentees),
      absenteesTime: fmtTime(absentees),
    };
  });

  const buildLocalDate = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) return null;
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return null;
    const [, year, month, day] = dateMatch.map(Number);
    const [, hours, minutes] = timeMatch.map(Number);
    const result = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(result.getTime())) return null;
    return result;
  };

  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  useEffect(() => {
    const loadActiveCommunity = async () => {
      const community = await storageService.getActiveCommunity();
      setActiveCommunity(community);
    };
    loadActiveCommunity();
  }, []);

  useEffect(() => {
    const loadPoll = async () => {
      if (!pollId || pollId === 'undefined' || !communityId || communityId === 'undefined') {
        return;
      }
      setLoading(true);
      try {
        const [pollData, resultsData, membershipData, votedData] = await Promise.all([
          pollService.getPoll(pollId),
          pollService.getResults(communityId, pollId).catch(() => null),
          pollService.getMembershipInfo(pollId).catch(() => null),
          pollService.hasVoted(pollId).catch(() => ({ has_voted: true })),
        ]);
        setPoll(pollData);
        setResults(resultsData);
        setMembershipInfo(membershipData);
        setHasVoted(votedData);
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.status === 402) {
          return;
        }
        console.error('Error loading poll:', error);
        setErrorDialogMessage('No se pudo cargar la votación');
        setIsErrorDialogOpen(true);
      } finally {
        setLoading(false);
      }
    };
    void loadPoll();
  }, [communityId, pollId]);

  const canManage = isAdminOrPresident(activeCommunity?.role);

  const showError = (message: string) => {
    setErrorDialogMessage(message);
    setIsErrorDialogOpen(true);
  };

  const handleClosePoll = async () => {
    if (!poll) return;
    setIsClosing(true);
    try {
      const updated = await pollService.closePoll(poll.id);
      setPoll(updated);
      const newResults = await pollService.getResults(communityId, poll.id).catch(() => null);
      setResults(newResults);
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 402) {
        return;
      }
      console.error('Error closing poll:', error);
      showError('No se pudo cerrar la votación');
    } finally {
      setIsClosing(false);
    }
  };

  const handlePublish = async () => {
    if (!poll) return;

    const startAt = buildLocalDate(publishDates.startDate, publishDates.startTime);
    const endAt = buildLocalDate(publishDates.endDate, publishDates.endTime);
    const absenteesEndAt = buildLocalDate(publishDates.absenteesDate, publishDates.absenteesTime);

    if (!startAt || !endAt || !absenteesEndAt) {
      showError('Debes completar todas las fechas y horas para publicar la votación');
      return;
    }

    if (endAt <= startAt) {
      showError('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }
    if (absenteesEndAt <= endAt) {
      showError('La fecha de cierre de ausentes debe ser posterior a la fecha de fin');
      return;
    }

    setIsPublishing(true);
    try {
      const updated = await pollService.publishPoll(poll.id, {
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        absentees_end_at: absenteesEndAt.toISOString(),
      });
      setPoll(updated);
      setPublishDialogOpen(false);
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 402) {
        return;
      }
      console.error('[Publish] Error:', error);
      console.error('[Publish] Error response:', isAxiosError(error) ? error.response : undefined);
      console.error('[Publish] Error data:', isAxiosError(error) ? error.response?.data : undefined);
      const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
      showError(
        detail
          ? typeof detail === 'string'
            ? detail
            : JSON.stringify(detail)
          : 'No se pudo publicar la votación'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!poll) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-bold text-foreground">
          No se encontró la votación
        </Text>
        <Button className="mt-4" onPress={() => router.push(`/${communityId}/votaciones` as any)}>
          <Text>Volver</Text>
        </Button>
      </View>
    );
  }

  const statusLabel: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING: 'Pendiente',
    ACTIVE: 'Activa',
    WAITING_ABSENTEES: 'Esperando ausentes',
    FINISHED: 'Finalizada',
    CANCELLED: 'Cancelada',
    UNKNOWN: 'Desconocido',
  };

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground',
    PENDING: 'bg-yellow-500/10 text-yellow-600',
    ACTIVE: 'bg-green-500/10 text-green-600',
    WAITING_ABSENTEES: 'bg-orange-500/10 text-orange-600',
    FINISHED: 'bg-blue-500/10 text-blue-600',
    CANCELLED: 'bg-red-500/10 text-red-600',
    UNKNOWN: 'bg-muted text-muted-foreground',
  };

  const showResults = results && (poll.current_status === 'FINISHED' || poll.current_status === 'WAITING_ABSENTEES');

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: poll.title,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push(`/${communityId}/votaciones` as any)}
              className="ml-2 rounded-full p-2 active:bg-muted">
              <Icon as={ChevronLeft} size={24} className="text-foreground" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            canManage && poll.current_status !== 'FINISHED' && poll.current_status !== 'CANCELLED' ? (
              <View className="flex-row items-center gap-2 mr-2">
                {poll.current_status === 'ACTIVE' && (
                  <TouchableOpacity
                    onPress={handleClosePoll}
                    disabled={isClosing}
                    className="rounded-full p-2 active:bg-muted">
                    {isClosing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Icon as={Lock} size={22} className="text-foreground" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : null,
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="mb-6 flex-row items-center justify-between">
          <View
            className={cn(
              'rounded-full px-3 py-1 border border-border',
              statusColor[poll.current_status]?.split(' ')[0]
            )}>
            <Text className={cn('text-xs font-bold uppercase', statusColor[poll.current_status]?.split(' ')[1])}>
              {statusLabel[poll.current_status] || poll.current_status}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5">
            <Icon as={Calendar} size={14} className="text-muted-foreground" />
            <Text className="text-[10px] font-medium text-muted-foreground">
              {new Date(poll.created_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        <Card className="border-border bg-card/50 mb-6">
          <CardContent className="p-6">
            <View className="mb-4 flex-row items-center gap-2">
              <Icon as={Scale} size={20} className="text-primary" />
              <Text className="text-lg font-bold text-foreground">Descripción</Text>
            </View>
            <Text className="text-base leading-6 text-muted-foreground">
              {poll.description || 'Sin descripción'}
            </Text>
          </CardContent>
        </Card>

        {poll.start_at && (
          <Card className="border-border mb-6">
            <CardContent className="p-4">
              <Text className="text-sm font-bold text-foreground mb-2">Fechas</Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Inicio</Text>
                  <Text className="text-xs font-medium text-foreground">
                    {new Date(poll.start_at).toLocaleString('es-ES')}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Fin</Text>
                  <Text className="text-xs font-medium text-foreground">
                    {new Date(poll.end_at!).toLocaleString('es-ES')}
                  </Text>
                </View>
                {poll.absentees_end_at && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Cierre ausentes</Text>
                    <Text className="text-xs font-medium text-foreground">
                      {new Date(poll.absentees_end_at).toLocaleString('es-ES')}
                    </Text>
                  </View>
                )}
              </View>
            </CardContent>
          </Card>
        )}

        {canManage && poll.current_status === 'DRAFT' && (
          <View className="mb-6 gap-3">
            <Button
              variant="outline"
              className="w-full"
              onPress={() =>
                router.push(`/${communityId}/votaciones/edit?pollId=${poll.id}` as any)
              }>
              <Text>Editar votación</Text>
            </Button>
            <Button
              className="w-full gap-2"
              onPress={() => setPublishDialogOpen(true)}
              disabled={isPublishing}>
              {isPublishing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon as={Send} size={18} className="text-primary-foreground" />
                  <Text className="text-base font-bold text-primary-foreground">
                    Publicar y enviar enlaces de voto
                  </Text>
                </>
              )}
            </Button>
          </View>
        )}

        {showResults && (
          <View className="gap-4 mb-6">
            <View className="flex-row items-center gap-2 mb-2">
              <Icon as={PieChart} size={20} className="text-primary" />
              <Text className="text-lg font-bold text-foreground">Escrutinio</Text>
            </View>

            <Card className="border-border">
              <CardContent className="p-4">
                <View className="flex-row items-center gap-2 mb-4">
                  <Icon as={UserCheck} size={16} className="text-primary" />
                  <Text className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Quórum Activo
                  </Text>
                </View>

                <Text className="text-xs text-muted-foreground mb-3">
                  Censo electoral excluyendo propiedades morosas (Art. 15.2 LPH)
                </Text>

                <View className="gap-3">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Votantes elegibles</Text>
                    <Text className="text-xs font-bold text-foreground">
                      {results!.census_eligible_voters} personas
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Cuotas elegibles</Text>
                    <Text className="text-xs font-bold text-foreground">
                      {results!.census_eligible_coefficient}%
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Votos emitidos</Text>
                    <Text className="text-xs font-bold text-foreground">
                      {results!.total_votes_cast}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted-foreground">Votos presuntos</Text>
                    <Text className="text-xs font-bold text-foreground">
                      {results!.presumed_votes_applied}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {results!.results.map((result, index) => (
              <Card key={index} className="border-border">
                <CardContent className="p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Icon as={CheckCircle2} size={18} className="text-primary" />
                      <Text className="text-base font-bold text-foreground">
                        {result.option_text}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-3">
                    <View>
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs text-muted-foreground">Votos (Personas)</Text>
                        <Text className="text-xs font-bold text-foreground">
                          {result.total_votes_count}
                        </Text>
                      </View>
                      <View className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${
                              results!.total_votes_cast > 0
                                ? (result.total_votes_count / results!.total_votes_cast) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </View>
                    </View>

                    <View>
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs text-muted-foreground">Cuotas (%)</Text>
                        <Text className="text-xs font-bold text-foreground">
                          {result.total_coefficient}%
                        </Text>
                      </View>
                      <View className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full bg-primary/60"
                          style={{
                            width: `${
                              results!.census_eligible_coefficient > 0
                                ? (result.total_coefficient / results!.census_eligible_coefficient) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {canManage && poll.current_status === 'ACTIVE' && (
          <View className="mb-6">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onPress={handleClosePoll}
              disabled={isClosing}>
              {isClosing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon as={Lock} size={18} className="text-destructive-foreground" />
                  <Text className="text-destructive-foreground font-bold">Cerrar votación</Text>
                </>
              )}
            </Button>
          </View>
        )}

        {poll.current_status === 'ACTIVE' && !membershipInfo?.is_defaulter && hasVoted && !hasVoted.has_voted && (
          <Card className="border-primary/30 bg-primary/5 mb-6">
            <CardContent className="p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Icon as={Send} size={18} className="text-primary" />
                <Text className="text-sm font-bold text-primary">Votación abierta</Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                Has recibido un enlace de voto en tu correo electrónico. Haz clic en el enlace para acceder a la pantalla de votación y emitir tu voto de forma segura.
              </Text>
            </CardContent>
          </Card>
        )}

        {membershipInfo?.is_defaulter && poll.current_status === 'ACTIVE' && (
          <Card className="border-destructive/30 bg-destructive/5 mb-6">
            <CardContent className="p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Icon as={XCircle} size={18} className="text-destructive" />
                <Text className="text-sm font-bold text-destructive">
                  Derecho a voto suspendido
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                Su propiedad aparece como morosa. Según la LPH, no puede participar en esta votación.
              </Text>
            </CardContent>
          </Card>
        )}

        {hasVoted?.has_voted && poll.current_status === 'ACTIVE' && (
          <Card className="border-green-500/30 bg-green-500/5 mb-6">
            <CardContent className="p-4">
              <View className="flex-row items-center gap-2">
                <Icon as={CheckCircle2} size={18} className="text-green-600" />
                <Text className="text-sm font-bold text-green-600">
                  Ya ha votado en esta votación
                </Text>
              </View>
            </CardContent>
          </Card>
        )}
      </ScrollView>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar votación</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <Text className="text-sm text-muted-foreground">
              Configura las fechas de la votación. Se enviarán automáticamente los enlaces de voto por correo a todos los vecinos no morosos.
            </Text>

            <View className="gap-2">
              <Text className="text-xs font-medium text-foreground">Inicio</Text>
              <View className="flex-row gap-2">
                <Input
                  value={publishDates.startDate}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, startDate: v }))}
                  placeholder="DD/MM/AAAA"
                  className="flex-1 h-10 text-sm"
                />
                <Input
                  value={publishDates.startTime}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, startTime: v }))}
                  placeholder="HH:MM"
                  className="w-24 h-10 text-sm"
                />
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-xs font-medium text-foreground">Fin</Text>
              <View className="flex-row gap-2">
                <Input
                  value={publishDates.endDate}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, endDate: v }))}
                  placeholder="DD/MM/AAAA"
                  className="flex-1 h-10 text-sm"
                />
                <Input
                  value={publishDates.endTime}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, endTime: v }))}
                  placeholder="HH:MM"
                  className="w-24 h-10 text-sm"
                />
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-xs font-medium text-foreground">Cierre de ausentes</Text>
              <View className="flex-row gap-2">
                <Input
                  value={publishDates.absenteesDate}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, absenteesDate: v }))}
                  placeholder="DD/MM/AAAA"
                  className="flex-1 h-10 text-sm"
                />
                <Input
                  value={publishDates.absenteesTime}
                  onChangeText={(v) => setPublishDates((p) => ({ ...p, absenteesTime: v }))}
                  placeholder="HH:MM"
                  className="w-24 h-10 text-sm"
                />
              </View>
            </View>
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onPress={() => setPublishDialogOpen(false)}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              onPress={handlePublish}
              disabled={isPublishing}>
              {isPublishing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon as={Send} size={14} className="text-primary-foreground" />
                  <Text className="text-primary-foreground font-bold">Publicar</Text>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>{errorDialogMessage}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setIsErrorDialogOpen(false)}>
              <Text>Cerrar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
