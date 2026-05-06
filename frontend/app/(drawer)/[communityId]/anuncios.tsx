import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, Modal, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  useAnnouncementsList,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAnnouncements';
import { type Announcement, type AnnouncementStatus } from '@/api/announcements';

import { AnnouncementCard } from '@/components/community/announcements/AnnouncementCard';
import { AnnouncementCreateModal } from '@/components/community/announcements/AnnouncementCreateModal';
import { normalizeRoleToBackendToken, getUserFacingErrorMessage } from '@/components/community/incidents/utils';

export type FilterStatus = 'todas' | 'DRAFT' | 'PUBLISHED';

const SCREEN_OPTIONS = {
  title: 'Tablón de Anuncios',
};

const EMPTY_ANNOUNCEMENTS: Announcement[] = [];

export default function AnunciosScreen() {
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
    if (membership) return normalizeRoleToBackendToken(membership.role);
    if (activeCommunity && String(activeCommunity.id) === String(communityId)) {
      return normalizeRoleToBackendToken(currentRole);
    }
    return null;
  }, [communityId, currentRole, user?.CommunitiesAndRole, activeCommunity]);

  const canManage = roleToken === '1' || roleToken === '4';
  const isDesktop = windowWidth >= 1024;
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

  // Form State
  const [titleDraft, setTitleDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<AnnouncementStatus>('PUBLISHED');
  const [scheduledDate, setScheduledDate] = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; name?: string | null; mimeType?: string | null; file?: unknown } | null>(null);
  const [formError, setFormError] = useState('');

  // Info Modal (for deletions, alerts)
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setInfoModal({ visible: true, title, message, onConfirm });
  };

  const allAnnouncementsQuery = useAnnouncementsList(communityId, undefined, !!communityId);

  useFocusEffect(
    useCallback(() => {
      if (communityId) {
        allAnnouncementsQuery.refetch();
      }
    }, [communityId, allAnnouncementsQuery])
  );

  const createMutation = useCreateAnnouncement(communityId);
  const deleteMutation = useDeleteAnnouncement(communityId);

  const filterTabs = useMemo<{ key: FilterStatus; label: string }[]>(() => {
    if (canManage) {
      return [
        { key: 'todas', label: 'Todos' },
        { key: 'PUBLISHED', label: 'Publicados' },
        { key: 'DRAFT', label: 'Borradores' },
      ];
    }
    return [];
  }, [canManage]);

  const allAnnouncements = allAnnouncementsQuery.data ?? EMPTY_ANNOUNCEMENTS;

  const filteredAnnouncements = useMemo(() => {
    if (!canManage) {
      return allAnnouncements.filter((a) => a.status === 'PUBLISHED');
    }
    if (activeFilter === 'todas') return allAnnouncements;
    return allAnnouncements.filter((a) => a.status === activeFilter);
  }, [activeFilter, allAnnouncements, canManage]);

  const resetCreateForm = () => {
    setTitleDraft('');
    setContentDraft('');
    setStatusDraft('PUBLISHED');
    setScheduledDate('');
    setPickedImage(null);
    setFormError('');
    setCreateModalVisible(false);
  };

  const onPickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], multiple: false });
      if (result.canceled) return;
      if (!result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setFormError('La imagen no puede exceder 5MB.');
        return;
      }

      setPickedImage({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: (asset as unknown as { file?: unknown }).file,
      });
      setFormError('');
    } catch {
      setFormError('No se pudo seleccionar la imagen.');
    }
  };

  const onCreate = async () => {
    setFormError('');
    const title = titleDraft.trim();
    const content = contentDraft.trim();

    if (!title || !content) {
      setFormError('Por favor completa el título y contenido.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        title,
        content,
        status: statusDraft,
        scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        image: pickedImage,
      });
      resetCreateForm();
      showAlert('Anuncio Creado', 'El anuncio ha sido creado exitosamente.');
    } catch (error: unknown) {
      setFormError(getUserFacingErrorMessage(error, 'No se pudo crear el anuncio.'));
    }
  };

  const onDeleteConfirm = (id: string) => {
    showAlert('Eliminar Anuncio', '¿Estás seguro de que deseas eliminar este anuncio?', () => {
      deleteMutation.mutate(id, {
        onError: (err) => {
          showAlert('Error', getUserFacingErrorMessage(err, 'No se pudo eliminar el anuncio.'));
        },
      });
    });
  };

  if (!communityId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Drawer.Screen options={SCREEN_OPTIONS} />
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={SCREEN_OPTIONS} />

      {/* Header */}
      <View className="px-5 pt-5 pb-3 border-b border-border/50 bg-card">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center">
              <Ionicons name="megaphone" size={20} color="#6366f1" />
            </View>
            <View>
              <Text className="text-xl font-bold text-foreground">Tablón de Anuncios</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {allAnnouncements.length} anuncio{allAnnouncements.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          {canManage && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { setCreateModalVisible(true); }}
              className="bg-indigo-600 dark:bg-indigo-500 rounded-xl h-10 px-4 flex-row items-center gap-1.5 shadow-sm"
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-semibold">Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View className="flex-row gap-2">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                className={`h-8 px-4 rounded-full items-center justify-center ${isActive ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-accent/60'}`}
                onPress={() => { setActiveFilter(tab.key); }}
              >
                <Text className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredAnnouncements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AnnouncementCard
            announcement={item}
            canManage={canManage}
            onPress={() => {
              router.push({
                pathname: '/[communityId]/anuncio/[id]',
                params: { communityId, id: item.id },
              });
            }}
            onDelete={() => { onDeleteConfirm(item.id); }}
          />
        )}
        ListEmptyComponent={
          allAnnouncementsQuery.isLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text className="text-sm text-muted-foreground mt-3">Cargando anuncios...</Text>
            </View>
          ) : (
            <View className="items-center justify-center py-20 px-8">
              <View className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center mb-5">
                <Ionicons name="megaphone-outline" size={36} color="#6366f1" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2">Sin anuncios</Text>
              <Text className="text-muted-foreground text-center text-sm leading-5 mb-6">
                {canManage
                  ? 'Todavía no se ha publicado ningún anuncio.\nCrea el primero tocando el botón "Nuevo".'
                  : 'Todavía no se ha publicado ningún anuncio.'
                }
              </Text>
              {canManage && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => { setCreateModalVisible(true); }}
                  className="bg-indigo-600 dark:bg-indigo-500 rounded-xl h-11 px-6 flex-row items-center gap-2"
                >
                  <Ionicons name="add-circle-outline" size={20} color="white" />
                  <Text className="text-white font-semibold">Crear primer anuncio</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {canManage && (
        <AnnouncementCreateModal
          visible={createModalVisible}
          titleDraft={titleDraft}
          setTitleDraft={setTitleDraft}
          contentDraft={contentDraft}
          setContentDraft={setContentDraft}
          statusDraft={statusDraft}
          setStatusDraft={setStatusDraft}
          scheduledDate={scheduledDate}
          setScheduledDate={setScheduledDate}
          pickedImage={pickedImage}
          formError={formError}
          setFormError={setFormError}
          isPending={createMutation.isPending}
          onClose={resetCreateForm}
          onPickImage={onPickImage}
          onSubmit={onCreate}
          modalCardStyle={modalCardStyle}
        />
      )}

      {/* INFO MODAL */}
      <Modal visible={infoModal.visible} transparent animationType="fade" onRequestClose={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}>
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
                    className="bg-red-600 dark:bg-red-500"
                    onPress={() => {
                      setInfoModal(prev => ({ ...prev, visible: false }));
                      setTimeout(() => infoModal.onConfirm?.(), 50);
                    }}
                  >
                    <Text className="text-white">Aceptar</Text>
                  </Button>
                </>
              ) : (
                <Button onPress={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}>
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
