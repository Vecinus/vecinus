import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Camera} from 'lucide-react-native';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImagePlus,
  Lightbulb,
  Menu,
  Plus,
  X,
} from 'lucide-react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { loadUserCommunities } from '@/services/communityService';
import {
  createIncident,
  getIncidentDetail,
  getIncidentHistory as fetchIncidentHistory,
  listIncidents,
  listMyIncidents,
  type IncidentContext,
  type IncidentHistoryEntry,
  updateIncidentStatus,
} from '@/services/incidentService';
import {
  INCIDENT_STATUS_LABEL,
  Incident,
  IncidentStatus,
} from '@/data/mock-incidencias';

type FilterStatus = 'todas' | 'mis_incidencias' | IncidentStatus;

const INCIDENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'LIGHTING', label: 'Iluminación' },
  { value: 'ELEVATOR', label: 'Ascensor' },
  { value: 'PLUMBING', label: 'Fontanería' },
  { value: 'ELECTRICITY', label: 'Electricidad' },
  { value: 'SAFETY', label: 'Seguridad' },
  { value: 'WORKERS', label: 'Trabajadores' },
  { value: 'POOL', label: 'Piscina' },
  { value: 'OTHER', label: 'Otros' },
];

const STATUS_ORDER: IncidentStatus[] = ['PENDING', 'IN PROGRESS', 'SOLVED', 'DISCARDED'];
const DROPDOWN_MAX_VISIBLE_ITEMS = 4;
const DROPDOWN_ITEM_HEIGHT = 48;
const DROPDOWN_MAX_HEIGHT = DROPDOWN_MAX_VISIBLE_ITEMS * DROPDOWN_ITEM_HEIGHT;

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'PENDING': { text: '#B42318', bg: '#FEE4E2', border: '#FECDCA' },
  'IN PROGRESS': { text: '#B54708', bg: '#FEF0C7', border: '#FEDF89' },
  'SOLVED': { text: '#067647', bg: '#D1FADF', border: '#A6F4C5' },
  'DISCARDED': { text: '#991B1B', bg: '#FEE2E2', border: '#FECACA' },
};
const statusIcons = {
  'PENDING': AlertTriangle,
  'IN PROGRESS': Clock3,
  'SOLVED': CheckCircle2,
  'DISCARDED': X,
};

// Normalizar status para asegurar que sea uno de los valores válidos
const normalizeStatus = (status: string | IncidentStatus): IncidentStatus => {
  if (!status) return 'PENDING';
  
  const statusStr = String(status).toUpperCase().trim();
  
  // Mapear variaciones comunes a STATUS_ORDER
  if (statusStr === 'PENDING' || statusStr === 'PENDIENTE') return 'PENDING';
  if (statusStr === 'IN PROGRESS' || statusStr === 'INPROGRESS' || statusStr === 'EN PROCESO') return 'IN PROGRESS';
  if (statusStr === 'SOLVED' || statusStr === 'COMPLETE' || statusStr === 'COMPLETED' || statusStr === 'RESUELTO') return 'SOLVED';
  if (statusStr === 'DISCARDED' || statusStr === 'REJECTED' || statusStr === 'RECHAZADO') return 'DISCARDED';
  
  // Por defecto, retornar PENDING
  return 'PENDING';
};

// Determinar qué estados de transición están permitidos según el estado actual
const getAllowedStatusTransitions = (currentStatus: IncidentStatus): IncidentStatus[] => {
  switch (currentStatus) {
    case 'PENDING':
      return ['IN PROGRESS', 'DISCARDED'];
    case 'IN PROGRESS':
      return ['SOLVED', 'DISCARDED'];
    case 'SOLVED':
    case 'DISCARDED':
      return []; // No se pueden cambiar estados finales
    default:
      return [];
  }
};
export default function IncidenciasScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const { comunidad_id } = useLocalSearchParams();
  const normalizedComunidadId = useMemo(
    () => (Array.isArray(comunidad_id) ? comunidad_id[0] : comunidad_id),
    [comunidad_id]
  );

  const { token } = useAuthStore();
  const {
    activeCommunityId,
    activeCommunityName,
    activeCommunityRole,
    communities,
    setActiveCommunity,
  } = useCommunityStore();

  const canManageStatus = activeCommunityRole === 1 || activeCommunityRole === 4;

  const [incidencias, setIncidencias] = useState<Incident[]>([]);
  const [myIncidencias, setMyIncidencias] = useState<Incident[]>([]);
  const [incidentContext, setIncidentContext] = useState<IncidentContext | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todas');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentHistory, setIncidentHistory] = useState<IncidentHistoryEntry[]>([]);
  const [draftStatus, setDraftStatus] = useState<IncidentStatus>('PENDING');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [renderStatusMenu, setRenderStatusMenu] = useState(false);
  const [renderTypeMenu, setRenderTypeMenu] = useState(false);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const statusMenuAnim = useRef(new Animated.Value(0)).current;
  const typeMenuAnim = useRef(new Animated.Value(0)).current;

  const [newType, setNewType] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageName, setNewImageName] = useState<string | null>(null);
  const [newImageAsset, setNewImageAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const currentUserId = incidentContext?.currentUserId ?? '';
  const currentUserName = incidentContext?.currentUserName ?? 'Vecino';

  useEffect(() => {
    if (communities.length === 0 && token) {
      void loadUserCommunities(token);
    }
  }, [communities.length, token]);

  useEffect(() => {
    if (!normalizedComunidadId || communities.length === 0) return;

    const currentCommunity = communities.find(
      (community) => String(community.id) === String(normalizedComunidadId)
    );

    if (currentCommunity && currentCommunity.id !== activeCommunityId) {
      setActiveCommunity(
        currentCommunity.id,
        currentCommunity.name,
        currentCommunity.address,
        currentCommunity.role
      );
    }
  }, [normalizedComunidadId, communities, activeCommunityId, setActiveCommunity]);

  useEffect(() => {
    if (!activeCommunityId || !normalizedComunidadId) return;
    if (String(activeCommunityId) !== String(normalizedComunidadId)) {
      router.replace(`/comunities/${activeCommunityId}/incidencias` as Href);
    }
  }, [activeCommunityId, normalizedComunidadId, router]);

  useEffect(() => {
    if (!normalizedComunidadId || !token) {
      setIncidencias([]);
      return;
    }

    let cancelled = false;

    const loadIncidencias = async () => {
      try {
        const result = await listIncidents(String(normalizedComunidadId), token);
        if (!cancelled) {
          setIncidencias(result.incidents);
          setIncidentContext(result.context);
        }
      } catch (error) {
        if (!cancelled) {
          setIncidencias([]);
          const message = error instanceof Error ? error.message : 'No se pudieron cargar las incidencias.';
          Alert.alert('Error', message);
        }
      }
    };

    void loadIncidencias();

    return () => {
      cancelled = true;
    };
  }, [normalizedComunidadId, token]);

  useEffect(() => {
    if (!normalizedComunidadId || !token || activeFilter !== 'mis_incidencias') return;

    let cancelled = false;

    const loadMyIncidencias = async () => {
      try {
        const result = await listMyIncidents(String(normalizedComunidadId), token);
        if (!cancelled) {
          setMyIncidencias(result.incidents);
          if (!incidentContext) {
            setIncidentContext(result.context);
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'No se pudieron cargar tus incidencias.';
          Alert.alert('Error', message);
        }
      }
    };

    void loadMyIncidencias();

    return () => {
      cancelled = true;
    };
  }, [activeFilter, incidentContext, normalizedComunidadId, token]);

  useEffect(() => {
    if (typeMenuOpen) {
      setRenderTypeMenu(true);
      Animated.spring(typeMenuAnim, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(typeMenuAnim, {
      toValue: 0,
      duration: 170,
      easing: Easing.bezier(0.2, 0.0, 0.0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderTypeMenu(false);
      }
    });
  }, [typeMenuOpen, typeMenuAnim]);

  useEffect(() => {
    if (statusMenuOpen && canManageStatus) {
      setRenderStatusMenu(true);
      Animated.spring(statusMenuAnim, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(statusMenuAnim, {
      toValue: 0,
      duration: 170,
      easing: Easing.bezier(0.2, 0.0, 0.0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderStatusMenu(false);
      }
    });
  }, [statusMenuOpen, canManageStatus, statusMenuAnim]);

  const counts = useMemo(
    () => ({
      pendiente: incidencias.filter((item) => item.status === 'PENDING').length,
      en_proceso: incidencias.filter((item) => item.status === 'IN PROGRESS').length,
      resuelta: incidencias.filter((item) => item.status === 'SOLVED').length,
      rechazada: incidencias.filter((item) => item.status === 'DISCARDED').length,
    }),
    [incidencias]
  );

const filterTabs = useMemo<Array<{ key: any; label: string }>>(() => {
  const baseTabs = [
    { key: 'todas', label: 'Todas' },
    { key: 'PENDING', label: 'Pendientes' },
    { key: 'IN PROGRESS', label: 'En proceso' },
    { key: 'SOLVED', label: 'Resueltas' },
  ];

  if (canManageStatus) {
    return [...baseTabs, { key: 'DISCARDED', label: 'Rechazadas' }];
  }

  return [...baseTabs, { key: 'mis_incidencias', label: 'Mis incidencias' }];
}, [canManageStatus]);

  useEffect(() => {
    const isValid = filterTabs.some((tab) => tab.key === activeFilter);
    if (!isValid) {
      setActiveFilter('todas');
    }
  }, [filterTabs, activeFilter]);

  const filteredIncidencias = useMemo(() => {
    if (activeFilter === 'mis_incidencias') return myIncidencias;
    if (activeFilter === 'todas') return incidencias;
    return incidencias.filter((item) => item.status === activeFilter);
  }, [incidencias, activeFilter, myIncidencias]);

  const totalOpen = counts.pendiente + counts.en_proceso;

  const formatDate = (isoDate: string) => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(isoDate));
    } catch {
      return isoDate;
    }
  };

  const formatDateTime = (isoDate: string) => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoDate));
    } catch {
      return isoDate;
    }
  };

  const buildFallbackIncidentHistory = (
    incident: Incident | null
  ): Array<{ status: IncidentStatus; date: string }> => {
    if (!incident) return [];

    const normalizedStatus = normalizeStatus(incident.status);

    if (normalizedStatus === 'PENDING') {
      return [{ status: normalizedStatus, date: incident.createdAt }];
    }

    return [
      { status: 'PENDING', date: incident.createdAt },
      { status: normalizedStatus, date: new Date().toISOString() },
    ];
  };

  const openIncidentDetail = async (incident: Incident) => {
    setSelectedIncident(incident);
    setDraftStatus(normalizeStatus(incident.status));
    setIncidentHistory(buildFallbackIncidentHistory(incident));
    setStatusMenuOpen(false);
    setDetailModalOpen(true);

    if (!normalizedComunidadId || !token) return;

    try {
      const { incident: detailIncident, history } = await getIncidentDetail({
        associationId: String(normalizedComunidadId),
        incidentId: incident.id,
        token,
      });
      setSelectedIncident(detailIncident);
      setDraftStatus(normalizeStatus(detailIncident.status));
      setIncidentHistory(history);
    } catch (error) {
      console.error('Error loading incident detail:', error);
      // Keep initial data if detail endpoint fails
    }
  };

  const saveDraftStatus = async () => {
    if (!canManageStatus || !selectedIncident || !normalizedComunidadId || !token) return;
    if (draftStatus === selectedIncident.status) {
      setDetailModalOpen(false);
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await updateIncidentStatus({
        associationId: String(normalizedComunidadId),
        incidentId: selectedIncident.id,
        status: draftStatus,
        token,
      });

      setIncidencias((prev) =>
        prev.map((item) =>
          item.id === selectedIncident.id
            ? {
                ...item,
                status: draftStatus,
              }
            : item
        )
      );

      setMyIncidencias((prev) =>
        prev.map((item) =>
          item.id === selectedIncident.id
            ? {
                ...item,
                status: draftStatus,
              }
            : item
        )
      );

      setSelectedIncident((prev) =>
        prev
          ? {
              ...prev,
              status: draftStatus,
            }
          : prev
      );

      setIncidentHistory((prev) => [
        ...prev,
        { status: draftStatus, date: new Date().toISOString() },
      ]);

      setDetailModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el estado.';
      Alert.alert('Error', message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        multiple: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        console.log('📁 Archivo seleccionado:', {
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          file: (asset as any).file ? 'Tiene file property' : 'Sin file property',
        });
        setNewImageAsset(asset);
        setNewImageName(asset.name);
      }
    } catch (error) {
      console.error('Error en pickImage:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const createIncidencia = async () => {
    const description = newDescription.trim();

    if (!newType || !description) {
      Alert.alert('Campos incompletos', 'Selecciona un tipo y completa la descripcion.');
      return;
    }

    if (description.length < 10) {
      Alert.alert('Descripción muy corta', 'La descripción debe tener al menos 10 caracteres.');
      return;
    }

    if (description.length > 500) {
      Alert.alert('Descripción muy larga', 'La descripción no puede exceder 500 caracteres.');
      return;
    }

    if (!token || !normalizedComunidadId) {
      Alert.alert('Error', 'No se encontro sesion activa para crear la incidencia.');
      return;
    }

    try {
      setIsSubmittingIncident(true);

      await createIncident({
        associationId: String(normalizedComunidadId),
        token,
        type: newType,
        description,
        image: newImageAsset
          ? {
              uri: newImageAsset.uri,
              name: newImageAsset.name || newImageAsset.uri.split('/').pop() || 'incidencia.jpg',
              mimeType: newImageAsset.mimeType || 'image/jpeg',
              file: (newImageAsset as any).file, // Pasar el File object si está disponible (Expo Web)
            }
          : null,
      });

      const result = await listIncidents(String(normalizedComunidadId), token);
      setIncidencias(result.incidents);
      setIncidentContext(result.context);

      if (activeFilter === 'mis_incidencias') {
        const mine = await listMyIncidents(String(normalizedComunidadId), token);
        setMyIncidencias(mine.incidents);
      }

      setCreateModalOpen(false);
      setNewType('');
      setNewDescription('');
      setNewImageName(null);
      setNewImageAsset(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la incidencia.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const normalizedStatus = normalizeStatus(item.status);
    const tone = STATUS_COLORS[normalizedStatus];
    const StatusIcon = statusIcons[normalizedStatus];

    return (
      <TouchableOpacity style={styles.card} onPress={() => void openIncidentDetail(item)} activeOpacity={0.9}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconWrap}>
              <AlertTriangle color="#B54708" size={24} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <StatusIcon color={tone.text} size={14} />
            <Text style={[styles.statusBadgeText, { color: tone.text }]}>
              {INCIDENT_STATUS_LABEL[normalizedStatus]}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <Text style={styles.cardMeta}>
            Reportado por: {item.reporterName}  •  {formatDate(item.createdAt)}
          </Text>

          <Text style={styles.readOnlyNote}>
            {canManageStatus
              ? 'Pulsa para ver detalle y cambiar estado.'
              : 'Solo presidente y administrador pueden editar el estado.'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
            <Menu color="#0F172A" size={28} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Incidencias</Text>
            <Text style={styles.headerSubtitle}>{activeCommunityName || 'Comunidad'}</Text>
          </View>
        </View>

        <View style={styles.headerStatsPill}>
          <Text style={styles.headerStatsPillText}>{totalOpen} abiertas</Text>
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.newButton} onPress={() => setCreateModalOpen(true)}>
            <Plus color="#FFFFFF" size={15} />
            <Text style={styles.newButtonText}>Nueva incidencia</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#B42318' }]}>{counts.pendiente}</Text>
            <Text style={styles.kpiLabel}>Pendientes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#B54708' }]}>{counts.en_proceso}</Text>
            <Text style={styles.kpiLabel}>En proceso</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#067647' }]}>{counts.resuelta}</Text>
            <Text style={styles.kpiLabel}>Resueltas</Text>
          </View>
        </View>

        <View style={[styles.filterRow, !isDesktop && styles.filterRowMobile]}>
          {filterTabs.map((tab) => {
            const selected = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  !isDesktop && styles.filterTabMobile,
                  selected && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.filterText,
                    isDesktop ? styles.filterTextDesktop : styles.filterTextMobile,
                    selected && styles.filterTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filteredIncidencias}
          keyExtractor={(item) => item.id}
          renderItem={renderIncident}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <AlertTriangle color="#64748B" size={22} />
              </View>
                <Text style={styles.emptyTitle}>No hay incidencias en {filterTabs.find((tab) => tab.key === activeFilter)?.label.toLowerCase()}</Text>
              <Text style={styles.emptySubtitle}>Puedes cambiar el filtro o crear una incidencia nueva para mantener el seguimiento.</Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={() => setCreateModalOpen(true)}>
                <Plus color="#FFFFFF" size={16} />
                <Text style={styles.emptyStateButtonText}>Nueva incidencia</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      <Modal
        visible={createModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createModalContent}>
            <View style={styles.createModalHeader}>
              <Text style={styles.modalTitle}>Reportar incidencia</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setCreateModalOpen(false)}>
                <X color="#475569" size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tipo de incidencia</Text>
            <View style={styles.dropdownFieldWrap}>
              <TouchableOpacity
                style={styles.statusDropdown}
                onPress={() => setTypeMenuOpen((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Text style={styles.statusDropdownText}>
                  {INCIDENT_TYPES.find((type) => type.value === newType)?.label || 'Selecciona un tipo'}
                </Text>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: typeMenuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <ChevronDown color="#64748B" size={20} />
                </Animated.View>
              </TouchableOpacity>

              {renderTypeMenu ? (
                <Animated.View
                  style={[
                    styles.statusPickerCard,
                    styles.dropdownMenuOverlay,
                    {
                      opacity: typeMenuAnim,
                      transform: [
                        {
                          translateY: typeMenuAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-8, 0],
                          }),
                        },
                        {
                          scaleY: typeMenuAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.92, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <ScrollView
                    style={styles.dropdownScroll}
                    contentContainerStyle={styles.dropdownScrollContent}
                    showsVerticalScrollIndicator
                    persistentScrollbar
                    nestedScrollEnabled
                    indicatorStyle="black"
                  >
                    {INCIDENT_TYPES.map((type) => {
                      const selected = newType === type.value;
                      return (
                        <TouchableOpacity
                          key={`type-picker-${type.value}`}
                          style={[
                            styles.statusPickerItem,
                            selected && {
                              backgroundColor: '#2CC9BB',
                            },
                          ]}
                          onPress={() => {
                            setNewType(type.value);
                            setTypeMenuOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.statusPickerText,
                              selected && { color: '#083344', fontWeight: '700' },
                            ]}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>Descripcion</Text>
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Describe el problema con detalle..."
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.createTextarea]}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Fotografia</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
              <Camera color="#1E293B" size={20} />
              <Text style={styles.uploadBoxText}>{newImageName || 'Adjuntar foto'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.createSubmitButton,
                (!newType || !newDescription.trim()) && styles.createSubmitButtonDisabled,
              ]}
              onPress={() => void createIncidencia()}
              disabled={!newType || !newDescription.trim() || isSubmittingIncident}
            >
              <Text style={styles.createSubmitButtonText}>
                {isSubmittingIncident ? 'Enviando...' : 'Enviar incidencia'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.detailModalContent}
            contentContainerStyle={styles.detailModalContentInner}
            showsVerticalScrollIndicator
          >
            <View style={styles.createModalHeader}>
              <View style={styles.detailTitleRow}>
                <Lightbulb color="#1E293B" size={22} />
                <Text style={styles.modalTitle}>{selectedIncident?.title || 'Incidencia'}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setDetailModalOpen(false)}>
                <X color="#475569" size={22} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailImagePlaceholder}>
              {selectedIncident?.image ? (
                <Image 
                  source={{ uri: selectedIncident.image }} 
                  style={styles.detailImage}
                />
              ) : (
                <ImagePlus color="#94A3B8" size={26} />
              )}
            </View>

            <Text style={styles.sectionLabel}>Descripcion</Text>
            <Text style={styles.detailDescription}>{selectedIncident?.description}</Text>

            {selectedIncident ? (
              <View style={styles.metaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Reportado por</Text>
                  <Text style={styles.metaValue}>{selectedIncident.reporterName}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Fecha</Text>
                  <Text style={styles.metaValue}>{formatDate(selectedIncident.createdAt)}</Text>
                </View>
              </View>
            ) : null}

            {canManageStatus && selectedIncident && getAllowedStatusTransitions(normalizeStatus(selectedIncident.status)).length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Estado actual</Text>
                <View style={styles.dropdownFieldWrap}>
                  <TouchableOpacity
                    style={[
                      styles.statusDropdown,
                    ]}
                    onPress={() => setStatusMenuOpen((prev) => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.statusDropdownText,
                    ]}>{INCIDENT_STATUS_LABEL[draftStatus]}</Text>
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: statusMenuAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '180deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <ChevronDown color="#64748B" size={20} />
                    </Animated.View>
                  </TouchableOpacity>

                  {renderStatusMenu ? (
                    <Animated.View
                      style={[
                        styles.statusPickerCard,
                        styles.dropdownMenuOverlay,
                        {
                          opacity: statusMenuAnim,
                          transform: [
                            {
                              translateY: statusMenuAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 0],
                              }),
                            },
                            {
                              scaleY: statusMenuAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <ScrollView
                        style={styles.dropdownScroll}
                        contentContainerStyle={styles.dropdownScrollContent}
                        showsVerticalScrollIndicator
                        persistentScrollbar
                        nestedScrollEnabled
                        indicatorStyle="black"
                      >
                        {getAllowedStatusTransitions(normalizeStatus(selectedIncident.status)).map((status) => {
                          const selected = draftStatus === status;
                          return (
                            <TouchableOpacity
                              key={`detail-${status}`}
                              style={[
                                styles.statusPickerItem,
                                selected && {
                                  backgroundColor: '#2CC9BB',
                                },
                              ]}
                              onPress={() => {
                                setDraftStatus(status);
                                setStatusMenuOpen(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.statusPickerText,
                                  selected && { color: '#083344', fontWeight: '700' },
                                ]}
                              >
                                {INCIDENT_STATUS_LABEL[status]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </Animated.View>
                  ) : null}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>Historial de estados</Text>
            <View style={styles.historyList}>
              {incidentHistory.map((entry, index) => {
                const normalizedStatus = normalizeStatus(entry.status);
                const tone = STATUS_COLORS[normalizedStatus];
                const Icon = statusIcons[normalizedStatus];

                return (
                  <View key={`${normalizedStatus}-${entry.date}-${index}`} style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: tone.bg }]}>
                      <Icon color={tone.text} size={14} />
                    </View>
                    <View>
                      <Text style={styles.historyTitle}>{INCIDENT_STATUS_LABEL[normalizedStatus]}</Text>
                      <Text style={styles.historyDate}>{formatDateTime(entry.date)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {!canManageStatus ? (
              <Text style={styles.readOnlyNote}>Solo presidente y administrador pueden editar el estado.</Text>
            ) : null}

            {canManageStatus && selectedIncident && getAllowedStatusTransitions(selectedIncident.status ? normalizeStatus(selectedIncident.status) : 'PENDING').length > 0 ? (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => void saveDraftStatus()}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.modalButtonPrimaryText}>
                    {isUpdatingStatus ? 'Guardando...' : 'Guardar cambios'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
  },
  headerCard: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerStatsPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerStatsPillText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    marginTop: 2,
    fontSize: 14,
  },
  contentSection: {
    flex: 1,
  },
  actionsRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  kpiRowDesktop: {
    gap: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  kpiLabel: {
    marginTop: 4,
    color: '#64748B',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 8,
    paddingVertical: 4,
  },
  filterRowMobile: {
    gap: 6,
  },
  filterTab: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabMobile: {
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 9,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterText: {
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
  },
  filterTextDesktop: {
    fontSize: 16,
  },
  filterTextMobile: {
    fontSize: 12,
  },
  filterTextActive: {
    color: '#0F172A',
  },
  listContent: {
    paddingBottom: 20,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  cardBody: {
    marginLeft: 56,
    marginTop: -10,
  },
  cardDescription: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 21,
    marginTop: 0,
  },
  cardMeta: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusActionBtn: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  statusActionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyNote: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 230,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 520,
  },
  emptyStateButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 10,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
  },
  uploadBoxText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  dropdownFieldWrap: {
    position: 'relative',
    zIndex: 30,
    marginBottom: 10,
  },
  statusPickerCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  dropdownMenuOverlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    zIndex: 60,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  dropdownScroll: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  dropdownScrollContent: {
    gap: 8,
    paddingRight: 6,
  },
  statusPickerItem: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  statusPickerText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '500',
  },
  textarea: {
    minHeight: 120,
  },
  createTextarea: {
    minHeight: 140,
    borderRadius: 16,
    borderColor: '#E2E8F0', // Borde más suave
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  createModalContent: {
    width: '90%', // Un poco más estrecho para móviles
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 32, // Esquinas mucho más redondeadas como en la imagen 2
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 0, // Quitamos el borde gris exterior
    elevation: 10, // Sombra para Android
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPickerWrap: {
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 18,
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  createSubmitButton: {
    backgroundColor: '#1D4ED8', // Azul más oscuro y profesional
    borderRadius: 14,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  createSubmitButtonDisabled: {
    opacity: 0.5,
  },
  createSubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  detailModalContent: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailModalContentInner: {
    paddingBottom: 8,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  detailImagePlaceholder: {
    marginTop: 4,
    marginBottom: 18,
    height: 190,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailDescription: {
    color: '#0F172A',
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  metaCol: {
    minWidth: 120,
  },
  metaLabel: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 2,
  },
  metaValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '500',
  },
  statusDropdown: {
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusDropdownDisabled: {
    opacity: 0.5,
    borderColor: '#CBD5E1',
  },
  statusDropdownText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '500',
  },
  statusDropdownTextDisabled: {
    color: '#94A3B8',
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  historyDate: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonGhost: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalButtonGhostText: {
    color: '#334155',
    fontWeight: '700',
  },
  modalButtonPrimary: {
    backgroundColor: '#2563EB',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lockedStatusNote: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
});
