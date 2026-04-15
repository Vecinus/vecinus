import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  View,
  Modal
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Drawer } from 'expo-router/drawer';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { communityApi, type Member } from '@/api/community';
import {
  type Incident,
  type IncidentStatus,
  type IncidentType,
} from '@/api/incidents';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateIncident,
  useIncidentsList,
  useDiscardIncident,
} from '@/hooks/useIncidents';

import { IncidentCreateModal } from '@/components/community/incidents/IncidentCreateModal';
import { IncidentFilters } from '@/components/community/incidents/IncidentFilters';
import { IncidentCard } from '@/components/community/incidents/IncidentCard';
import { normalizeRoleToBackendToken, getUserFacingErrorMessage } from '@/components/community/incidents/utils';

export type FilterStatus = 'todas' | 'mis_incidencias' | IncidentStatus;

const SCREEN_OPTIONS = {
  title: 'Incidencias',
};

const EMPTY_INCIDENTS: Incident[] = [];
const DESKTOP_BREAKPOINT = 1024;
const COMPACT_ACTIONS_BREAKPOINT = 430;

export default function IncidenciasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{ communityId?: string | string[] }>();
  const { activeCommunity, currentRole, user } = useAuth();

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

  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setInfoModal({ visible: true, title, message, onConfirm });
  };

  const allIncidentsQuery = useIncidentsList(communityId, false, !!communityId, user?.id);
  const myIncidentsQuery = useIncidentsList(communityId, true, !!communityId, user?.id);
  const membersQuery = useQuery<Member[], Error>({
    queryKey: ['incidents', 'members', communityId, user?.id],
    queryFn: () => communityApi.getMembers(communityId!),
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });

  useFocusEffect(
    useCallback(() => {
      if (communityId) {
        allIncidentsQuery.refetch();
        myIncidentsQuery.refetch();
      }
    }, [communityId, allIncidentsQuery, myIncidentsQuery])
  );

  const createIncidentMutation = useCreateIncident(communityId);
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
    if (activeCommunity?.id && String(activeCommunity.id) !== String(routeCommunityId)) {
      router.replace(`/${activeCommunity.id}/incidencias`);
    }
  }, [activeCommunity?.id, routeCommunityId, router]);

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

  const filteredIncidents = useMemo(() => {
    if (activeFilter === 'mis_incidencias') return myIncidents;
    if (activeFilter === 'todas') return allIncidents;
    return allIncidents.filter((incident) => incident.status === activeFilter);
  }, [activeFilter, allIncidents, myIncidents]);

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
      showAlert('Incidencia creada', 'El reporte se ha registrado correctamente.');
    } catch (error: unknown) {
      setFormError(getUserFacingErrorMessage(error, 'No se pudo crear la incidencia.'));
    }
  };

  const onOpenDetail = (incidentId: string) => {
    if (!communityId) return;
    router.push({ pathname: '/[communityId]/incidencia/[incidentId]', params: { communityId, incidentId } });
  };

  const handleDeleteConfirm = (incidentId: string) => {
    showAlert('Eliminar Incidencia', '¿Estás seguro de que deseas eliminar permanentemente esta incidencia?', () => {
      discardIncidentMutation.mutate(
        { incidentId },
        {
          onSuccess: () => {
            // Refech already handled by invalidateQueries in the hook
          },
          onError: (err) => {
            showAlert('Error', getUserFacingErrorMessage(err, 'No se pudo eliminar la incidencia.'));
          },
        }
      );
    });
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
    const isOwner =
      myIncidentIds.has(item.id) ||
      !!(myMembershipId && String(item.membershipId) === String(myMembershipId));
    const isAdminOrPresident = roleToken === '1' || roleToken === '4';
    const canDeleteThis =
      (isAdminOrPresident || isOwner) &&
      ['PENDING', 'SOLVED', 'DISCARDED'].includes(item.status);

    return (
      <IncidentCard
        incident={item}
        reporterText={getReporterText(item)}
        canManageStatus={canManageStatus}
        showDelete={canDeleteThis}
        onDelete={() => { handleDeleteConfirm(item.id); }}
        onPress={() => onOpenDetail(item.id)}
      />
    );
  };

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={SCREEN_OPTIONS} />

      <IncidentFilters
        filterTabs={filterTabs}
        activeFilter={activeFilter}
        setActiveFilter={(filter) => setActiveFilter(filter)}
        filteredCount={filteredIncidents.length}
        canCreateIncident={canCreateIncident}
        hasCompactActions={hasCompactActions}
        onCreatePress={() => setCreateModalVisible(true)}
      />

      {listError ? (
        <View className="mx-5 mt-2 mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
          <Text className="text-red-600 dark:text-red-400 font-semibold">{getUserFacingErrorMessage(listError, 'No se pudieron cargar las incidencias.')}</Text>
        </View>
      ) : null}

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

      {/* --- INFO MODAL --- */}
      <Modal visible={infoModal.visible} transparent animationType="fade" onRequestClose={() => {
        setInfoModal(prev => ({ ...prev, visible: false }));
      }}>
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
            <Text className="text-lg font-bold text-foreground mb-2">{infoModal.title}</Text>
            <Text className="text-muted-foreground mb-6">{infoModal.message}</Text>
            <View className="flex-row justify-end gap-3">
              {infoModal.onConfirm ? (
                <>
                  <Button variant="outline" onPress={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}>
                    <Text>Cancelar</Text>
                  </Button>
                  <Button
                    onPress={() => {
                      setInfoModal(prev => ({ ...prev, visible: false }));
                      setTimeout(() => infoModal.onConfirm?.(), 50);
                    }}
                  >
                    <Text>Eliminar</Text>
                  </Button>
                </>
              ) : (
                <Button
                  onPress={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}
                >
                  <Text>Aceptar</Text>
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}