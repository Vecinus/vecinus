import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Drawer } from 'expo-router/drawer';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Building,
  Plus,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { communityApi, type Member } from '@/api/community';
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  type Incident,
  type IncidentStatus,
  type IncidentType,
} from '@/api/incidents';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateIncident,
  useDiscardIncident,
  useIncidentDetail,
  useIncidentsList,
  useUpdateIncidentStatus,
} from '@/hooks/useIncidents';

import { STATUS_TONE, STATUS_ICON, TYPE_META, formatDate, formatDateTime, getAllowedStatusTransitions } from '@/components/community/incidents/constants';
import { IncidentCreateModal } from '@/components/community/incidents/IncidentCreateModal';
import { IncidentDetailModal } from '@/components/community/incidents/IncidentDetailModal';

type FilterStatus = 'todas' | 'mis_incidencias' | IncidentStatus;

type StatusTone = { text: string; bg: string; border: string };

const SCREEN_OPTIONS = {
  title: 'Incidencias',
};

const EMPTY_INCIDENTS: Incident[] = [];
const DESKTOP_BREAKPOINT = 1024;
const COMPACT_ACTIONS_BREAKPOINT = 430;

const normalizeRoleToBackendToken = (role: string | number | null): string | null => {
  if (role === null || typeof role === 'undefined') return null;

  if (typeof role === 'number') {
    return String(role);
  }

  const raw = String(role).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return String(Number.parseInt(raw, 10));

  const normalized = raw.toLowerCase();
  if (normalized === 'administrador' || normalized === 'admin') return '1';
  if (normalized === 'presidente' || normalized === 'president') return '4';
  if (normalized === 'empleado' || normalized === 'employee') return '5';

  return null;
};

const getErrorMessage = (error: any, fallback: string): string => {
  return error?.response?.data?.detail || error?.message || fallback;
};

const getUserFacingErrorMessage = (error: any, fallback: string): string => {
  const status = error?.response?.status;
  const detail = String(error?.response?.data?.detail ?? '').trim();

  if (status === 401) {
    return 'Tu sesion ha expirado. Cierra sesion y vuelve a iniciar sesion.';
  }

  if (status === 403) {
    if (detail.includes('Admins cannot create incidents')) {
      return 'Como administrador no puedes crear incidencias en esta comunidad.';
    }
    if (detail.includes('Admin, president or employee access required for this action')) {
      return 'Tu rol actual no permite cambiar el estado de esta incidencia.';
    }
    if (detail.includes('User does not own this incident')) {
      return 'Solo la persona que abrio esta incidencia puede eliminarla cuando esta revisada.';
    }
    if (detail.includes('User has no access to this association') || detail.includes('Access denied to this community')) {
      return 'No tienes acceso a la comunidad activa. Cambia de comunidad e intentalo de nuevo.';
    }
    return detail || 'No tienes permisos para realizar esta accion.';
  }

  if (status === 404) {
    return detail || 'No se encontro la incidencia solicitada.';
  }

  if (status === 400) {
    return detail || fallback;
  }

  return detail || getErrorMessage(error, fallback);
};

export default function IncidenciasScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{ communityId?: string | string[] }>();
  const { activeCommunity, currentRole, user, refreshUserContext } = useAuth();

  const routeCommunityId = Array.isArray(routeCommunityIdRaw) ? routeCommunityIdRaw[0] : routeCommunityIdRaw;
  const isInvalidRouteCommunityId =
    !routeCommunityId ||
    routeCommunityId === 'undefined' ||
    routeCommunityId === 'null' ||
    routeCommunityId === '[communityId]';
  const communityId = !isInvalidRouteCommunityId ? routeCommunityId : activeCommunity?.id;

  const roleToken = useMemo(() => {
    if (!communityId) return normalizeRoleToBackendToken(currentRole);

    const membership = user?.CommunitiesAndRole.find(
      (entry) => String(entry.community.id) === String(communityId)
    );

    if (membership) {
      return normalizeRoleToBackendToken(membership.role);
    }

    if (activeCommunity && String(activeCommunity.id) === String(communityId)) {
      return normalizeRoleToBackendToken(currentRole);
    }

    return null;
  }, [communityId, currentRole, user?.CommunitiesAndRole, activeCommunity]);

  const canCreateIncident = roleToken !== '1';
  const canManageStatus = roleToken === '1' || roleToken === '4' || roleToken === '5';
  const canSeeDiscardedFilter = roleToken === '1';
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;
  const hasCompactActions = windowWidth < COMPACT_ACTIONS_BREAKPOINT;

  const modalCardStyle = useMemo(
    () => ({
      width: '100%' as const,
      maxWidth: isDesktop ? 860 : 560,
      alignSelf: 'center' as const,
    }),
    [isDesktop]
  );

  const detailImageStyle = useMemo(
    () => ({
      width: '100%' as const,
      height: isDesktop ? 320 : 176,
      borderRadius: 12,
      marginBottom: 16,
      backgroundColor: '#F1F5F9',
    }),
    [isDesktop]
  );

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todas');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [typeDraft, setTypeDraft] = useState<IncidentType | ''>('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [pickedImage, setPickedImage] = useState<
    | {
        uri: string;
        name?: string | null;
        mimeType?: string | null;
        file?: unknown;
      }
    | null
  >(null);
  const [formError, setFormError] = useState('');

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<IncidentStatus>('PENDING');

  const allIncidentsQuery = useIncidentsList(communityId, false, !!communityId, user?.id);
  const myIncidentsQuery = useIncidentsList(communityId, true, !!communityId, user?.id);
  const membersQuery = useQuery<Member[], Error>({
    queryKey: ['incidents', 'members', communityId, user?.id],
    queryFn: () => communityApi.getMembers(communityId!),
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });
  const detailQuery = useIncidentDetail(
    communityId,
    selectedIncidentId,
    !!communityId && !!selectedIncidentId && detailModalVisible,
    user?.id
  );

  useFocusEffect(
    useCallback(() => {
      if (communityId) {
        allIncidentsQuery.refetch();
        myIncidentsQuery.refetch();
      }
    }, [communityId])
  );

  const createIncidentMutation = useCreateIncident(communityId);
  const updateStatusMutation = useUpdateIncidentStatus(communityId);
  const discardIncidentMutation = useDiscardIncident(communityId);

  const filterTabs = useMemo<{ key: FilterStatus; label: string }[]>(() => {
    const baseTabs: { key: FilterStatus; label: string }[] = [
      { key: 'todas', label: 'Todas' },
      { key: 'PENDING', label: 'Pendientes' },
      { key: 'IN PROGRESS', label: 'En proceso' },
      { key: 'SOLVED', label: 'Resueltas' },
    ];

    if (canSeeDiscardedFilter) {
      return [...baseTabs, { key: 'DISCARDED', label: 'Rechazadas' }];
    }

    return [...baseTabs, { key: 'mis_incidencias', label: 'Mis incidencias' }];
  }, [canSeeDiscardedFilter]);

  useEffect(() => {
    const isValid = filterTabs.some((tab) => tab.key === activeFilter);
    if (!isValid) setActiveFilter('todas');
  }, [filterTabs, activeFilter]);

  useEffect(() => {
    if (isInvalidRouteCommunityId && activeCommunity?.id) {
      // Keep route and active context aligned to avoid querying the wrong community.
      setSelectedIncidentId(null);
    }
  }, [activeCommunity?.id, isInvalidRouteCommunityId]);

  const allIncidents = allIncidentsQuery.data ?? EMPTY_INCIDENTS;
  const myIncidents = myIncidentsQuery.data ?? EMPTY_INCIDENTS;
  const myIncidentIds = useMemo(() => new Set(myIncidents.map((incident) => incident.id)), [myIncidents]);
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

  const allKnownIncidents = useMemo(() => {
    const incidentsById = new Map<string, Incident>();
    allIncidents.forEach((incident) => incidentsById.set(incident.id, incident));
    myIncidents.forEach((incident) => incidentsById.set(incident.id, incident));
    return Array.from(incidentsById.values());
  }, [allIncidents, myIncidents]);

  const filteredIncidents = useMemo(() => {
    if (activeFilter === 'mis_incidencias') return myIncidents;
    if (activeFilter === 'todas') return allIncidents;
    return allIncidents.filter((incident) => incident.status === activeFilter);
  }, [activeFilter, allIncidents, myIncidents]);

  const counts = useMemo(
    () => ({
      pending: allIncidents.filter((incident) => incident.status === 'PENDING').length,
      inProgress: allIncidents.filter((incident) => incident.status === 'IN PROGRESS').length,
      solved: allIncidents.filter((incident) => incident.status === 'SOLVED').length,
      discarded: allIncidents.filter((incident) => incident.status === 'DISCARDED').length,
    }),
    [allIncidents]
  );

  const selectedIncident = useMemo(() => {
    if (!selectedIncidentId) return null;

    return (
      detailQuery.data?.incident ?? allKnownIncidents.find((incident) => incident.id === selectedIncidentId) ?? null
    );
  }, [detailQuery.data?.incident, allKnownIncidents, selectedIncidentId]);

  const isSelectedIncidentOwned = useMemo(() => {
    if (!selectedIncident) return false;
    if (myIncidentIds.has(selectedIncident.id)) return true;
    if (!myMembershipId) return false;
    return String(selectedIncident.membershipId) === String(myMembershipId);
  }, [myIncidentIds, myMembershipId, selectedIncident]);

  const canDiscardSelectedIncident = useMemo(() => {
    if (!selectedIncident) return false;
    const isReviewed = selectedIncident.status === 'SOLVED' || selectedIncident.status === 'DISCARDED';
    return isReviewed && isSelectedIncidentOwned;
  }, [isSelectedIncidentOwned, selectedIncident]);

  const isSelectedIncidentReviewed = useMemo(() => {
    if (!selectedIncident) return false;
    return selectedIncident.status === 'SOLVED' || selectedIncident.status === 'DISCARDED';
  }, [selectedIncident]);

  const getReporterText = (incident: Incident): string => {
    if (myIncidentIds.has(incident.id)) return 'Abierta por ti';
    if (myMembershipId && String(incident.membershipId) === String(myMembershipId)) {
      return 'Abierta por ti';
    }

    const byMembership = incident.membershipId
      ? reporterNameByMembershipId.get(String(incident.membershipId))
      : undefined;
    if (byMembership) return `Abierta por ${byMembership}`;

    if (incident.reporterName && incident.reporterName !== 'Vecino') {
      return `Abierta por ${incident.reporterName}`;
    }

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

    return [
      {
        status: selectedIncident.status,
        date: selectedIncident.createdAt,
      },
    ];
  }, [detailQuery.data?.history, selectedIncident]);

  const selectedIncidentTransitions = useMemo(() => {
    if (!selectedIncident) return [];
    return getAllowedStatusTransitions(selectedIncident.status);
  }, [selectedIncident]);

  const isLoadingList =
    allIncidentsQuery.isLoading || (activeFilter === 'mis_incidencias' && myIncidentsQuery.isLoading);

  const listError =
    (activeFilter === 'mis_incidencias' ? myIncidentsQuery.error : allIncidentsQuery.error) ?? null;

  const resetCreateForm = () => {
    setTypeDraft('');
    setDescriptionDraft('');
    setPickedImage(null);
    setFormError('');
    setCreateModalVisible(false);
  };

  const onPickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setFormError('La imagen no puede exceder 5MB.');
        return;
      }

      setPickedImage({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: (asset as DocumentPicker.DocumentPickerAsset & { file?: unknown }).file,
      });
      setFormError('');
    } catch {
      setFormError('No se pudo seleccionar la imagen.');
    }
  };

  const onCreateIncident = async () => {
    setFormError('');

    const description = descriptionDraft.trim();
    if (!typeDraft || !description) {
      setFormError('Selecciona el tipo y completa la descripcion.');
      return;
    }

    if (description.length < 10) {
      setFormError('La descripcion debe tener al menos 10 caracteres.');
      return;
    }

    try {
      await createIncidentMutation.mutateAsync({
        type: typeDraft,
        description,
        image: pickedImage,
      });

      resetCreateForm();
      Alert.alert('Incidencia creada', 'El reporte se ha registrado correctamente.');
    } catch (error: any) {
      setFormError(getUserFacingErrorMessage(error, 'No se pudo crear la incidencia.'));
    }
  };

  const onOpenDetail = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setDetailModalVisible(true);
  };

  const onSaveStatus = async () => {
    if (!selectedIncident) return;
    if (draftStatus === selectedIncident.status) {
      setDetailModalVisible(false);
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        incidentId: selectedIncident.id,
        status: draftStatus,
      });

      setDetailModalVisible(false);
      Alert.alert('Estado actualizado', `La incidencia ahora esta ${INCIDENT_STATUS_LABEL[draftStatus].toLowerCase()}.`);
    } catch (error: any) {
      const shouldRetryAfterRefresh = error?.response?.status === 403 && canManageStatus;

      if (shouldRetryAfterRefresh) {
        await refreshUserContext();
        try {
          await updateStatusMutation.mutateAsync({
            incidentId: selectedIncident.id,
            status: draftStatus,
          });
          setDetailModalVisible(false);
          Alert.alert('Estado actualizado', `La incidencia ahora esta ${INCIDENT_STATUS_LABEL[draftStatus].toLowerCase()}.`);
          return;
        } catch (retryError: any) {
          Alert.alert('Error', getUserFacingErrorMessage(retryError, 'No se pudo actualizar el estado.'));
          setDraftStatus(selectedIncident.status);
          return;
        }
      }
      Alert.alert('Error', getUserFacingErrorMessage(error, 'No se pudo actualizar el estado.'));
      setDraftStatus(selectedIncident.status);
    }
  };

  const onConfirmDiscardIncident = async () => {
    if (!selectedIncident) return;

    try {
      await discardIncidentMutation.mutateAsync({
        incidentId: selectedIncident.id,
      });
      setDetailModalVisible(false);
      if (Platform.OS === 'web') {
        window.alert('La incidencia se ha eliminado correctamente.');
      } else {
        Alert.alert('Incidencia eliminada', 'La incidencia se ha eliminado correctamente.');
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert('Error: ' + getUserFacingErrorMessage(error, 'No se pudo eliminar la incidencia.'));
      } else {
        Alert.alert('Error', getUserFacingErrorMessage(error, 'No se pudo eliminar la incidencia.'));
      }
    }
  };

  const onDiscardIncident = () => {
    if (!canDiscardSelectedIncident) {
      if (Platform.OS === 'web') {
        window.alert('Solo el autor de la incidencia puede eliminarla cuando está revisada.');
      } else {
        Alert.alert(
          'No disponible',
          'Solo el autor de la incidencia puede eliminarla cuando esta revisada.'
        );
      }
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Seguro que quieres eliminar esta incidencia? Esta acción no se puede deshacer.');
      if (confirmed) {
        void onConfirmDiscardIncident();
      }
      return;
    }

    Alert.alert(
      'Eliminar incidencia',
      'Solo se pueden eliminar incidencias revisadas (resueltas o rechazadas). Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void onConfirmDiscardIncident();
          },
        },
      ]
    );
  };

  if (!communityId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-4 text-slate-500 font-semibold tracking-wide">Resolviendo comunidad activa...</Text>
      </View>
    );
  }

  const renderIncidentItem = ({ item }: { item: Incident }) => {
    const tone = STATUS_TONE[item.status];
    const StatusIcon = STATUS_ICON[item.status];
    const typeMeta = TYPE_META[item.type];
    const TypeIcon = typeMeta.icon;

    return (
      <TouchableOpacity
        className="bg-card border border-border rounded-2xl p-4 mb-3 shadow-sm"
        activeOpacity={0.9}
        onPress={() => onOpenDetail(item.id)}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-row items-center flex-1">
            <View
              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: typeMeta.bg }}
            >
              <TypeIcon size={22} color={typeMeta.color} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                {INCIDENT_TYPE_LABEL[item.type]}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{formatDate(item.createdAt)}</Text>
              <Text className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5" numberOfLines={1}>
                {getReporterText(item)}
              </Text>
            </View>
          </View>

          <View
            className="px-2.5 py-1 rounded-full border flex-row items-center"
            style={{ backgroundColor: tone.bg, borderColor: tone.border }}
          >
            <StatusIcon size={12} color={tone.text} />
            <Text className="ml-1 text-xs font-semibold" style={{ color: tone.text }}>
              {INCIDENT_STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <Text className="text-slate-700 dark:text-zinc-200 mt-3 leading-5" numberOfLines={3}>
          {item.description}
        </Text>

        <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
          {canManageStatus
            ? 'Pulsa para ver detalle y cambiar estado.'
            : 'Pulsa para ver detalle de la incidencia.'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={SCREEN_OPTIONS} />

      <View className="px-5 pb-3 mt-4">
        <View className="mb-4 flex-row items-center justify-between gap-3">
          <View className={`flex-row flex-1 ${hasCompactActions ? 'gap-2' : 'gap-3'}`}>
            <View className="flex-1 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 rounded-2xl py-3 items-center shadow-sm">
              <Text className="text-2xl font-black text-red-600 dark:text-red-500 text-center">{counts.pending}</Text>
              <Text className="text-[11px] font-bold text-red-700 dark:text-red-400 mt-0.5">Pendientes</Text>
            </View>
            <View className="flex-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 rounded-2xl py-3 items-center shadow-sm">
              <Text className="text-2xl font-black text-amber-600 dark:text-amber-500 text-center">{counts.inProgress}</Text>
              <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">Proceso</Text>
            </View>
            <View className="flex-1 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl py-3 items-center shadow-sm">
              <Text className="text-2xl font-black text-emerald-600 dark:text-emerald-500 text-center">{counts.solved}</Text>
              <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">Resueltas</Text>
            </View>
          </View>

          {canCreateIncident ? (
            <Button
              className={`h-11 shadow-md shadow-primary/20 ${hasCompactActions ? 'w-11 px-0' : 'px-4 gap-2'}`}
              onPress={() => setCreateModalVisible(true)}
            >
              <Plus size={18} color="#fff" />
              {!hasCompactActions ? <Text className="text-white font-bold">Nueva</Text> : null}
            </Button>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          <View className="flex-row gap-2">
            {filterTabs.map((tab) => {
              const selected = tab.key === activeFilter;
              return (
                <TouchableOpacity
                  key={tab.key}
                  className={`px-3.5 py-2.5 rounded-full border ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                  onPress={() => setActiveFilter(tab.key)}
                >
                  <Text className={`text-xs font-bold ${selected ? 'text-primary-foreground' : 'text-slate-700 dark:text-zinc-200'}`}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {listError ? (
        <View className="mx-5 mt-2 mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
          <Text className="text-red-600 dark:text-red-400 font-semibold">{getUserFacingErrorMessage(listError, 'No se pudieron cargar las incidencias.')}</Text>
        </View>
      ) : null}

      <View className="px-5 mt-2 mb-4">
        <View className="flex-row items-center">
          <AlertTriangle className="text-slate-800 dark:text-slate-200" size={26} strokeWidth={2.5} />
          <Text className="text-2xl font-black text-slate-900 dark:text-white ml-3 tracking-tight">Listado de avisos</Text>
        </View>
      </View>

      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={renderIncidentItem}
        ListEmptyComponent={
          isLoadingList ? (
            <View className="items-center justify-center py-14">
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text className="mt-4 text-slate-500 dark:text-zinc-400">Cargando incidencias...</Text>
            </View>
          ) : (
            <View className="items-center justify-center py-14">
              <Text className="text-lg font-bold text-slate-900 dark:text-white mb-2">No hay incidencias</Text>
              <Text className="text-slate-500 dark:text-zinc-400 text-center px-8">
                No hay elementos para el filtro seleccionado.
              </Text>
            </View>
          )
        }
      />

      <IncidentCreateModal
        visible={createModalVisible}
        typeDraft={typeDraft}
        setTypeDraft={(type) => {
          setTypeDraft(type);
          setFormError('');
        }}
        descriptionDraft={descriptionDraft}
        setDescriptionDraft={(text) => {
          setDescriptionDraft(text);
          if (formError) setFormError('');
        }}
        pickedImage={pickedImage}
        formError={formError}
        setFormError={setFormError}
        isPending={createIncidentMutation.isPending}
        onClose={resetCreateForm}
        onPickImage={onPickImage}
        onSubmit={onCreateIncident}
        modalCardStyle={modalCardStyle}
      />

      <IncidentDetailModal
        visible={detailModalVisible}
        selectedIncident={selectedIncident}
        getReporterText={getReporterText}
        isDesktop={isDesktop}
        detailImageStyle={detailImageStyle}
        modalCardStyle={modalCardStyle}
        selectedIncidentTransitions={selectedIncidentTransitions}
        canManageStatus={canManageStatus}
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        incidentHistory={incidentHistory}
        canDiscardSelectedIncident={canDiscardSelectedIncident}
        isSelectedIncidentReviewed={isSelectedIncidentReviewed}
        isPending={updateStatusMutation.isPending || discardIncidentMutation.isPending}
        onClose={() => setDetailModalVisible(false)}
        onSaveStatus={onSaveStatus}
        onDiscardIncident={onDiscardIncident}
      />
    </View>
  );
}
