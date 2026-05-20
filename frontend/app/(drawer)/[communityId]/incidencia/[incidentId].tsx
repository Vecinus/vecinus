import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Drawer } from 'expo-router/drawer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, ArrowLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { communityApi, type Member } from '@/api/community';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, type Incident, type IncidentStatus } from '@/api/incidents';
import { useAuth } from '@/context/AuthContext';
import { useIncidentDetail, useUpdateIncidentStatus, useDiscardIncident, useIncidentsList } from '@/hooks/useIncidents';

import { STATUS_TONE, STATUS_ICON, formatDate, formatDateTime, getAllowedStatusTransitions } from '@/components/community/incidents/constants';
import { normalizeRoleToBackendToken, getUserFacingErrorMessage } from '@/components/community/incidents/utils';

const DESKTOP_BREAKPOINT = 1024;

export default function IncidentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { activeCommunity, currentRole, user, refreshUserContext } = useAuth();

  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false,
    title: '',
    message: '',
  });

  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setInfoModal({ visible: true, title, message, onConfirm });
  };

  const params = useLocalSearchParams<{ communityId?: string | string[]; incidentId?: string | string[] }>();

  const routeCommunityIdRaw = params.communityId;
  const routeCommunityId = Array.isArray(routeCommunityIdRaw) ? routeCommunityIdRaw[0] : routeCommunityIdRaw;
  const isInvalidRouteCommunityId =
    !routeCommunityId ||
    routeCommunityId === 'undefined' ||
    routeCommunityId === 'null' ||
    routeCommunityId === '[communityId]';
  const communityId = !isInvalidRouteCommunityId ? routeCommunityId : activeCommunity?.id;

  const routeIncidentIdRaw = params.incidentId;
  const incidentId = (Array.isArray(routeIncidentIdRaw) ? routeIncidentIdRaw[0] : routeIncidentIdRaw) as string;

  const handleGoBack = useCallback(() => {
    if (communityId) {
      router.replace(`/${communityId}/incidencias`);
    } else {
      router.back();
    }
  }, [communityId, router]);
  const roleToken = useMemo(() => {
    if (!communityId) return normalizeRoleToBackendToken(currentRole);
    const membership = user?.CommunitiesAndRole.find((entry) => String(entry.community.id) === String(communityId));
    if (membership) return normalizeRoleToBackendToken(membership.role);
    if (activeCommunity && String(activeCommunity.id) === String(communityId)) return normalizeRoleToBackendToken(currentRole);
    return null;
  }, [communityId, currentRole, user?.CommunitiesAndRole, activeCommunity]);

  const canManageStatus = roleToken === '1' || roleToken === '4' || roleToken === '5';
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;

  const cardStyle = useMemo(() => ({
    width: '100%' as const,
    maxWidth: isDesktop ? 860 : undefined,
    alignSelf: 'center' as const,
  }), [isDesktop]);

  const detailImageStyle = useMemo(() => ({
    width: '100%' as const,
    height: isDesktop ? 320 : 176,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
  }), [isDesktop]);

  const [draftStatus, setDraftStatus] = useState<IncidentStatus>('PENDING');

  const [isIncidentDeleted, setIsIncidentDeleted] = useState(false);

  const membersQuery = useQuery<Member[], Error>({
    queryKey: ['incidents', 'members', communityId, user?.id],
    queryFn: () => communityApi.getMembers(communityId as string),
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });

  const detailQuery = useIncidentDetail(communityId, incidentId, !!communityId && !!incidentId && !isIncidentDeleted, user?.id);

  const myIncidentsQuery = useIncidentsList(communityId, true, !!communityId, user?.id);
  const myIncidentIds = useMemo(
    () => new Set((myIncidentsQuery.data ?? []).map((incident) => incident.id)),
    [myIncidentsQuery.data]
  );

  const updateStatusMutation = useUpdateIncidentStatus(communityId);
  const discardIncidentMutation = useDiscardIncident(communityId);

  const selectedIncident = detailQuery.data?.incident ?? null;

  const myMembershipId = useMemo(() => {
    if (!user?.id) return null;
    const me = (membersQuery.data ?? []).find((member) => String(member.id) === String(user.id));
    return me?.membershipId ?? null;
  }, [membersQuery.data, user?.id]);

  const reporterNameByMembershipId = useMemo(() => {
    const map = new Map<string, string>();
    (membersQuery.data ?? []).forEach((member) => {
      map.set(String(member.membershipId), member.name);
    });
    return map;
  }, [membersQuery.data]);

  const isSelectedIncidentOwned = useMemo(() => {
    if (!selectedIncident) return false;
    if (myIncidentIds.has(selectedIncident.id)) return true;
    if (!myMembershipId) return false;
    return String(selectedIncident.membershipId) === String(myMembershipId);
  }, [myIncidentIds, myMembershipId, selectedIncident]);

  const canDiscardSelectedIncident = useMemo(() => {
    if (!selectedIncident) return false;
    const isReviewed = selectedIncident.status === 'SOLVED' || selectedIncident.status === 'DISCARDED';
    const isAdminOrPresident = roleToken === '1' || roleToken === '4';
    return isReviewed && (isAdminOrPresident || isSelectedIncidentOwned);
  }, [isSelectedIncidentOwned, selectedIncident, roleToken]);

  const isSelectedIncidentReviewed = useMemo(() => {
    if (!selectedIncident) return false;
    return selectedIncident.status === 'SOLVED' || selectedIncident.status === 'DISCARDED';
  }, [selectedIncident]);

  const getReporterText = (incident: Incident): string => {
    if (myIncidentIds.has(incident.id)) return 'Abierta por ti';
    if (myMembershipId && String(incident.membershipId) === String(myMembershipId)) return 'Abierta por ti';

    if (incident.reporterName && incident.reporterName !== 'Vecino' && incident.reporterName !== 'Usuario sin nombre') {
      return `Abierta por ${incident.reporterName}`;
    }

    const byMembership = incident.membershipId ? reporterNameByMembershipId.get(String(incident.membershipId)) : undefined;
    if (byMembership && byMembership !== 'Usuario sin nombre') return `Abierta por ${byMembership}`;

    return 'Abierta por un vecino';
  };

  useEffect(() => {
    if (selectedIncident?.status) {
      setDraftStatus(selectedIncident.status);
    }
  }, [selectedIncident?.id, selectedIncident?.status]);

  const incidentHistory = useMemo(() => {
    if (detailQuery.data?.history?.length) return detailQuery.data.history;
    if (!selectedIncident) return [];
    return [{ status: selectedIncident.status, date: selectedIncident.createdAt }];
  }, [detailQuery.data?.history, selectedIncident]);

  const selectedIncidentTransitions = useMemo(() => {
    if (!selectedIncident) return [];
    return getAllowedStatusTransitions(selectedIncident.status);
  }, [selectedIncident]);

  const onSaveStatus = async () => {
    if (!selectedIncident) return;
    if (draftStatus === selectedIncident.status) return;

    try {
      await updateStatusMutation.mutateAsync({ incidentId: selectedIncident.id, status: draftStatus });
      showAlert('Estado actualizado', `La incidencia ahora está ${INCIDENT_STATUS_LABEL[draftStatus].toLowerCase()}.`); // nosemgrep
      detailQuery.refetch();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      const shouldRetryAfterRefresh = err?.response?.status === 403 && canManageStatus;
      if (shouldRetryAfterRefresh) {
        await refreshUserContext();
        try {
          await updateStatusMutation.mutateAsync({ incidentId: selectedIncident.id, status: draftStatus });
          showAlert('Estado actualizado', `La incidencia ahora está ${INCIDENT_STATUS_LABEL[draftStatus].toLowerCase()}.`); // nosemgrep
          detailQuery.refetch();
          return;
        } catch (retryError: unknown) {
          showAlert('Error', getUserFacingErrorMessage(retryError, 'No se pudo actualizar el estado.'));
          setDraftStatus(selectedIncident.status);
          return;
        }
      }
      showAlert('Error', getUserFacingErrorMessage(error, 'No se pudo actualizar el estado.'));
      setDraftStatus(selectedIncident.status);
    }
  };

  const onConfirmDiscardIncident = async () => {
    if (!selectedIncident) return;
    try {
      await discardIncidentMutation.mutateAsync({ incidentId: selectedIncident.id });
      // Marcar como borrada para deshabilitar la query y evitar refetches
      setIsIncidentDeleted(true);
      showAlert('Incidencia eliminada', 'La incidencia se ha eliminado correctamente.', () => {
        handleGoBack();
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 403 && canManageStatus) {
        await refreshUserContext();
        try {
          await discardIncidentMutation.mutateAsync({ incidentId: selectedIncident.id });
          // Marcar como borrada para deshabilitar la query
          setIsIncidentDeleted(true);
          showAlert('Incidencia eliminada', 'La incidencia se ha eliminado correctamente.', () => {
            handleGoBack();
          });
          return;
        } catch (retryError: unknown) {
          showAlert('Error', getUserFacingErrorMessage(retryError, 'No se pudo eliminar la incidencia.'));
          return;
        }
      }
      showAlert('Error', getUserFacingErrorMessage(error, 'No se pudo eliminar la incidencia.'));
    }
  };

  const onDiscardIncident = () => {
    setConfirmModal({
      visible: true,
      title: 'Eliminar Incidencia',
      message: '¿Deseas eliminar definitivamente esta incidencia? Esta acción no se puede deshacer.',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        void onConfirmDiscardIncident();
      }
    });
  };

  const isPending = updateStatusMutation.isPending || discardIncidentMutation.isPending;
  const detailErrorMessage = detailQuery.isError
    ? getUserFacingErrorMessage(
      detailQuery.error,
      'No se pudo cargar la incidencia. Comprueba que pertenece a esta comunidad.'
    )
    : '';

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={{
        title: 'Detalle de Incidencia',
        headerLeft: () => (
          <TouchableOpacity onPress={handleGoBack} className="ml-4 p-2 cursor-pointer">
            <ArrowLeft className="text-foreground" size={24} />
          </TouchableOpacity>
        )
      }} />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-card rounded-3xl p-6 border border-border shadow-sm mb-6" style={cardStyle}>
          {detailQuery.isError ? (
            <View className="items-center py-10">
              <Text className="text-red-600 dark:text-red-400 font-semibold">Error al cargar la incidencia</Text>
              <Text className="mt-3 text-center text-slate-500 dark:text-zinc-400">{detailErrorMessage}</Text>
              <View className="mt-4 flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => detailQuery.refetch()}
                >
                  <Text>Reintentar</Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={handleGoBack}
                >
                  <Text>Volver</Text>
                </Button>
              </View>
            </View>
          ) : detailQuery.isLoading || membersQuery.isLoading || !selectedIncident ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#4f46e5" />
              <Text className="mt-3 text-slate-500 dark:text-zinc-400">Cargando detalle...</Text>
            </View>
          ) : (
            <>
              <View className="flex-row items-center gap-2 mb-2">
                <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 flex-wrap">
                  {INCIDENT_TYPE_LABEL[selectedIncident.type]}
                </Text>
              </View>

              <Text className="text-sm text-slate-500 dark:text-zinc-300 mb-4">
                Reportada el {formatDate(selectedIncident.createdAt)}
              </Text>
              <Text className="text-sm text-slate-500 dark:text-zinc-300 mb-4">
                {getReporterText(selectedIncident)}
              </Text>

              {selectedIncident.imageUrl ? (
                <Image
                  source={{ uri: selectedIncident.imageUrl }}
                  style={detailImageStyle}
                  resizeMode={isDesktop ? 'contain' : 'cover'}
                />
              ) : null}

              <Text className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Descripcion</Text>
              <Text className="text-slate-700 dark:text-zinc-200 leading-6 mb-4">{selectedIncident.description}</Text>

              <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Estado</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {selectedIncidentTransitions.length > 0 && canManageStatus
                  ? [selectedIncident.status, ...selectedIncidentTransitions].map((statusOption, index, array) => {
                    if (array.indexOf(statusOption) !== index) return null;
                    const selected = draftStatus === statusOption;
                    return (
                      <TouchableOpacity
                        key={statusOption}
                        className={`px-3 py-2 rounded-lg border flex-row items-center gap-2 ${selected ? 'bg-emerald-500 border-emerald-500' : 'bg-muted border-border'
                          }`}
                        onPress={() => setDraftStatus(statusOption)}
                      >
                        <Text
                          className={`text-xs font-semibold ${selected ? 'text-primary-foreground' : 'text-slate-700 dark:text-zinc-200'
                            }`}
                        >
                          {INCIDENT_STATUS_LABEL[statusOption] /* nosemgrep */}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                  : (
                    <View
                      className="px-3 py-2 rounded-lg border flex-row items-center gap-2"
                      style={{
                        backgroundColor: STATUS_TONE[selectedIncident.status].bg,
                        borderColor: STATUS_TONE[selectedIncident.status].border,
                      }}
                    >
                      <Text
                        style={{ color: STATUS_TONE[selectedIncident.status].text }}
                        className="text-xs font-semibold"
                      >
                        {INCIDENT_STATUS_LABEL[selectedIncident.status]}
                      </Text>
                    </View>
                  )}
              </View>

              <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Historial</Text>
              <View className="mb-2">
                {incidentHistory.map((entry, index) => {
                  const Icon = STATUS_ICON[entry.status];
                  return (
                    <View key={`${entry.date}-${index}`} className="flex-row items-center mb-2">
                      <View
                        className="w-7 h-7 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: STATUS_TONE[entry.status].bg }}
                      >
                        <Icon size={14} color={STATUS_TONE[entry.status].text} />
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                          {INCIDENT_STATUS_LABEL[entry.status]}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-zinc-400">
                          {formatDateTime(entry.date)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {!canManageStatus ? (
                <Text className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                  Solo administrador, presidente o empleado pueden cambiar estados.
                </Text>
              ) : null}

              {canDiscardSelectedIncident ? (
                <Button
                  variant="outline"
                  className="h-11 mb-3 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                  onPress={onDiscardIncident}
                  disabled={isPending}
                >
                  {isPending ? (
                    <ActivityIndicator color="#dc2626" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#dc2626" />
                      <Text className="ml-2 font-semibold text-red-600 dark:text-red-400">Eliminar incidencia</Text>
                    </>
                  )}
                </Button>
              ) : null}

              {!canDiscardSelectedIncident && isSelectedIncidentReviewed ? (
                <Text className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                  Solo el autor de la incidencia puede eliminarla cuando esta revisada.
                </Text>
              ) : null}

              <View className="flex-row gap-3 mt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onPress={handleGoBack}
                  disabled={isPending}
                >
                  <Text className="font-semibold text-foreground">Volver</Text>
                </Button>

                {canManageStatus && selectedIncidentTransitions.length > 0 && draftStatus !== selectedIncident.status ? (
                  <Button
                    className="flex-1 h-12"
                    onPress={onSaveStatus}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-primary-foreground font-semibold">Guardar</Text>
                    )}
                  </Button>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* --- INFO MODAL --- */}
      <Modal visible={infoModal.visible} transparent animationType="fade" onRequestClose={() => {
        setInfoModal(prev => ({ ...prev, visible: false }));
        infoModal.onConfirm?.();
      }}>
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
            <Text className="text-lg font-bold text-foreground mb-2">{infoModal.title}</Text>
            <Text className="text-muted-foreground mb-6">{infoModal.message}</Text>
            <View className="flex-row justify-end gap-3">
              <Button
                onPress={() => {
                  setInfoModal(prev => ({ ...prev, visible: false }));
                  if (infoModal.onConfirm) {
                    setTimeout(() => infoModal.onConfirm?.(), 50);
                  }
                }}
              >
                <Text>Aceptar</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- CONFIRM MODAL --- */}
      <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}>
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
            <Text className="text-lg font-bold text-foreground mb-2">{confirmModal.title}</Text>
            <Text className="text-muted-foreground mb-6">{confirmModal.message}</Text>
            <View className="flex-row justify-end gap-3">
              <Button
                variant="outline"
                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
              >
                <Text>Cancelar</Text>
              </Button>
              <Button
                variant="destructive"
                onPress={confirmModal.onConfirm}
              >
                <Text className="text-destructive-foreground">Eliminar</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
