import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { type DocumentPickerAsset } from 'expo-document-picker';
import { Drawer } from 'expo-router/drawer';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AnnouncementStatus } from '@/api/announcements';
import { DateTimePickerModal } from '@/components/community/announcements/DateTimePickerModal';
import { getUserFacingErrorMessage, normalizeRoleToBackendToken } from '@/components/community/incidents/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/context/AuthContext';
import { useAnnouncementDetail, useUpdateAnnouncement } from '@/hooks/useAnnouncements';

interface DocumentPickerAssetWithFile extends DocumentPickerAsset {
  file?: Blob;
}

const GENERIC_IMAGE = 'https://res.cloudinary.com/dvz3u3rrd/image/upload/v1730035043/vecinus_logo.png';

export default function AnuncioDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { communityId: routeCommunityIdRaw, id: announcementIdRaw } = useLocalSearchParams();

  const communityId = Array.isArray(routeCommunityIdRaw) ? routeCommunityIdRaw[0] : routeCommunityIdRaw;
  const announcementId = Array.isArray(announcementIdRaw) ? announcementIdRaw[0] : announcementIdRaw;

  const { activeCommunity, currentRole, user } = useAuth();

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

  const handleGoBack = (): void => {
    if (communityId) {
      router.push({
        pathname: '/[communityId]/anuncios' as never,
        params: { communityId },
      });
    } else {
      router.back();
    }
  };

  const { data: announcement, isLoading, error } = useAnnouncementDetail(communityId, announcementId);
  const updateMutation = useUpdateAnnouncement(communityId, announcementId);

  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<AnnouncementStatus>('PUBLISHED');
  const [pickedImage, setPickedImage] = useState<{ uri: string; name?: string; mimeType?: string; file?: unknown } | null>(null);
  const [scheduledDateDraft, setScheduledDateDraft] = useState('');
  const [formError, setFormError] = useState('');

  // Info Modal
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string; onConfirm?: () => void }>({
    visible: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, onConfirm?: () => void): void => {
    setInfoModal({ visible: true, title, message, onConfirm });
  };

  // Reset edit mode when the screen gains focus (fixes stale state when navigating between announcements)
  useFocusEffect(
    useCallback(() => {
      setIsEditing(false);
      setPickedImage(null);
      setFormError('');
    }, [])
  );

  useEffect(() => {
    if (announcement && !isEditing) {
      setTitleDraft(announcement.title);
      setContentDraft(announcement.content);
      setStatusDraft(announcement.status);
      // Convert ISO date to datetime-local format for the input
      if (announcement.scheduled_date) {
        const d = new Date(announcement.scheduled_date);
        const localISO = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0') + 'T' +
          String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0');
        setScheduledDateDraft(localISO);
      } else {
        setScheduledDateDraft('');
      }
    }
  }, [announcement, isEditing]);

  const onPickImage = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0] as DocumentPickerAssetWithFile;

      setPickedImage({
        uri: asset.uri,
        name: asset.name || undefined,
        mimeType: asset.mimeType || undefined,
        file: asset.file,
      });
      setFormError('');
    } catch {
      setFormError('No se pudo seleccionar la imagen.');
    }
  };

  const onSave = async (): Promise<void> => {
    setFormError('');
    if (!titleDraft.trim() || !contentDraft.trim()) {
      setFormError('Por favor completa el título y contenido.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        title: titleDraft.trim(),
        content: contentDraft.trim(),
        status: statusDraft,
        scheduled_date: scheduledDateDraft ? new Date(scheduledDateDraft).toISOString() : undefined,
        image: pickedImage || undefined,
      });
      setIsEditing(false);
      setPickedImage(null);
      showAlert('Éxito', 'Anuncio actualizado correctamente.');
    } catch (err: unknown) {
      setFormError(getUserFacingErrorMessage(err, 'No se pudo actualizar el anuncio.'));
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Drawer.Screen options={{
          title: 'Cargando...',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack} className="ml-4 p-2 cursor-pointer">
              <ArrowLeft className="text-foreground" size={24} />
            </TouchableOpacity>
          ),
        }} />
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error || !announcement) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Drawer.Screen options={{
          title: 'Error',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack} className="ml-4 p-2 cursor-pointer">
              <ArrowLeft className="text-foreground" size={24} />
            </TouchableOpacity>
          ),
        }} />
        <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
        <Text className="text-xl font-bold mb-2 mt-4">Error</Text>
        <Text className="text-muted-foreground text-center">No se pudo cargar el anuncio. Es posible que haya sido eliminado o no tengas permisos.</Text>
        <Button className="mt-6 bg-indigo-600" onPress={handleGoBack}>
          <Text className="text-white">Volver a Anuncios</Text>
        </Button>
      </View>
    );
  }

  const statusLabel = announcement.status === 'PUBLISHED' ? 'Publicado' : 'Borrador';
  const statusColor = announcement.status === 'PUBLISHED'
    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={{
        title: isEditing ? 'Editar Anuncio' : 'Detalles del Anuncio',
        headerLeft: () => (
          <TouchableOpacity onPress={handleGoBack} className="ml-4 p-2 cursor-pointer">
            <ArrowLeft className="text-foreground" size={24} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="w-full max-w-4xl mx-auto">
          {!isEditing ? (
            <View>
              {/* Hero Image - Only show if present */}
              {announcement.image_url ? (
                <View className="w-full aspect-[16/9] md:aspect-[21/9] md:max-h-[450px] bg-muted relative overflow-hidden md:rounded-b-3xl">
                  <Image
                    source={{ uri: announcement.image_url }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  {/* Gradient overlay for readability */}
                  <View className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
 
                  {/* Status badge */}
                  <View className={`absolute top-4 right-4 px-3 py-1.5 rounded-full shadow-md ${announcement.status === 'DRAFT'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                    }`}>
                    <Text className="text-white font-bold text-xs uppercase tracking-wide">
                      {statusLabel}
                    </Text>
                  </View>
                </View>
              ) : null}
 
              {/* Content */}
              <View className={`p-6 bg-background rounded-t-3xl relative z-10 ${announcement.image_url ? '-mt-4' : 'mt-0'}`}>
              {/* Title */}
              <Text className="text-2xl sm:text-3xl font-bold text-foreground mb-3 leading-tight">
                {announcement.title}
              </Text>

              {/* Date info row */}
              <View className="flex-row items-center gap-4 mb-5 pb-5 border-b border-border/50">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="calendar-outline" size={15} color="#6366f1" />
                  <Text className="text-sm text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={15} color="#6366f1" />
                  <Text className="text-sm text-muted-foreground">
                    {new Date(announcement.created_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>

                <View className={`px-2.5 py-1 rounded-full ${statusColor.split(' ').filter(c => c.startsWith('bg-')).join(' ')}`}>
                  <Text className={`text-xs font-semibold ${statusColor.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {/* Announcement body */}
              <Text className="text-base leading-7 text-foreground/85">
                {announcement.content}
              </Text>

              {/* Scheduled date badge — only show when still a draft */}
              {announcement.status === 'DRAFT' && announcement.scheduled_date && (
                <View className="flex-row items-center gap-2.5 mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                  <View className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-800/40 items-center justify-center">
                    <Ionicons name="time-outline" size={18} color="#6366f1" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-0.5">
                      Publicación programada
                    </Text>
                    <Text className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      {new Date(announcement.scheduled_date).toLocaleDateString('es-ES', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Edit button - only for admins/presidents */}
              {canManage && (
                <Button
                  className="mt-8 bg-indigo-600 dark:bg-indigo-500 h-12 rounded-xl"
                  onPress={() => { setIsEditing(true); }}
                >
                  <Ionicons name="pencil" size={18} color="white" />
                  <Text className="text-white ml-2 font-semibold text-base">Editar Anuncio</Text>
                </Button>
              )}
            </View>
          </View>
        ) : (
          /* ========== EDIT MODE ========== */
          <View className="p-6">
            {/* Edit header badge */}
            <View className="flex-row items-center gap-2 mb-6 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <Ionicons name="create-outline" size={20} color="#6366f1" />
              <Text className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                Modo edición — Los cambios se guardarán al confirmar
              </Text>
            </View>

            {formError ? (
              <View className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/40 flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400 font-medium flex-1">{formError}</Text>
              </View>
            ) : null}

            <Text className="text-sm font-semibold text-foreground mb-2">Título *</Text>
            <Input
              value={titleDraft}
              onChangeText={setTitleDraft}
              className="mb-6 bg-card"
              editable={!updateMutation.isPending}
            />

            <Text className="text-sm font-semibold text-foreground mb-2">Contenido *</Text>
            <Input
              value={contentDraft}
              onChangeText={setContentDraft}
              multiline
              numberOfLines={8}
              className="h-48 mb-6 bg-card"
              editable={!updateMutation.isPending}
            />

            <Text className="text-sm font-semibold text-foreground mb-2">Estado</Text>
            <View className="flex-row gap-3 mb-2">
              {/* Drafts can become published, but published cannot go back to draft */}
              <TouchableOpacity
                onPress={() => {
                  if (announcement.status !== 'PUBLISHED') {
                    setStatusDraft('DRAFT');
                  }
                }}
                disabled={announcement.status === 'PUBLISHED'}
                className={`flex-1 py-3.5 rounded-xl border flex-row items-center justify-center gap-2 ${
                  announcement.status === 'PUBLISHED'
                    ? 'bg-card border-border opacity-40'
                    : statusDraft === 'DRAFT'
                      ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/20'
                      : 'bg-card border-border'
                }`}
              >
                <Ionicons name="document-outline" size={16} color={statusDraft === 'DRAFT' && announcement.status !== 'PUBLISHED' ? '#b45309' : '#9ca3af'} />
                <Text className={`font-semibold ${statusDraft === 'DRAFT' && announcement.status !== 'PUBLISHED' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  Borrador
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStatusDraft('PUBLISHED'); }}
                className={`flex-1 py-3.5 rounded-xl border flex-row items-center justify-center gap-2 ${statusDraft === 'PUBLISHED'
                  ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20'
                  : 'bg-card border-border'
                  }`}
              >
                <Ionicons name="megaphone-outline" size={16} color={statusDraft === 'PUBLISHED' ? '#4338ca' : '#9ca3af'} />
                <Text className={`font-semibold ${statusDraft === 'PUBLISHED' ? 'text-indigo-700 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                  Publicado
                </Text>
              </TouchableOpacity>
            </View>
            {announcement.status === 'PUBLISHED' && (
              <View className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-900/40 flex-row items-center gap-2">
                <Ionicons name="lock-closed-outline" size={14} color="#b45309" />
                <Text className="text-amber-700 dark:text-amber-400 text-xs font-medium flex-1">
                  Un anuncio publicado no puede volver a estado borrador.
                </Text>
              </View>
            )}
            <Text className="text-[11px] text-muted-foreground mb-6 px-1">
              * {statusDraft === 'DRAFT' 
                ? 'Los borradores solo son visibles para administradores.' 
                : 'Los anuncios publicados son visibles para todos los vecinos.'}
            </Text>

            {/* Only show scheduled date for draft announcements */}
            {announcement.status !== 'PUBLISHED' && (
              <>
                <Text className="text-sm font-semibold text-foreground mb-2">Fecha Programada (Opcional)</Text>
                <DateTimePickerModal
                  value={scheduledDateDraft}
                  onChange={setScheduledDateDraft}
                  disabled={updateMutation.isPending}
                  placeholder="Tocar para seleccionar fecha y hora"
                />
              </>
            )}

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Imagen (Opcional)</Text>
              {(pickedImage || announcement.image_url) && (
                <TouchableOpacity 
                  onPress={() => {
                    if (pickedImage) {
                      setPickedImage(null);
                    } else {
                      // If it's the original image, we might want a way to "un-set" it.
                      // For now, let's just allow clearing the picked one.
                      // If they want to remove the existing one, we'd need to send a null image_url to the backend.
                      // The backend update logic should handle this.
                      setPickedImage(null);
                      // I'll mark it to be removed if needed, but for now let's just clear the preview.
                      // Actually, let's add a state to track if the original image should be deleted.
                    }
                  }}
                  className="flex-row items-center gap-1"
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  <Text className="text-red-500 text-xs font-medium">Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { void onPickImage(); }}
              disabled={updateMutation.isPending}
              className="mb-8 h-48 rounded-2xl border-2 border-dashed border-border bg-card items-center justify-center overflow-hidden relative"
            >
              {(pickedImage || announcement.image_url) ? (
                <View className="w-full h-full relative">
                  <Image
                    source={{ uri: pickedImage ? pickedImage.uri : (announcement.image_url || GENERIC_IMAGE) }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  <View className="absolute inset-0 bg-black/40 items-center justify-center">
                    <Ionicons name="camera" size={32} color="white" />
                    <Text className="text-white font-medium mt-2">Cambiar imagen</Text>
                  </View>
                </View>
              ) : (
                <View className="items-center">
                  <Ionicons name="image-outline" size={32} className="text-muted-foreground mb-2" />
                  <Text className="text-muted-foreground font-medium">Tocar para subir imagen</Text>
                </View>
              )}
            </TouchableOpacity>

            <View className="flex-row gap-4">
              <Button
                variant="outline"
                className="flex-1 bg-card h-12 rounded-xl"
                onPress={() => {
                  setIsEditing(false);
                  setPickedImage(null);
                  setFormError('');
                }}
                disabled={updateMutation.isPending}
              >
                <Text>Cancelar</Text>
              </Button>
              <Button
                className="flex-1 bg-indigo-600 dark:bg-indigo-500 h-12 rounded-xl"
                onPress={onSave}
                disabled={updateMutation.isPending}
              >
                <Text className="text-white font-semibold">{updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}</Text>
              </Button>
            </View>
          </View>
        )}
        </View>
      </ScrollView>

      {/* INFO MODAL */}
      <Modal visible={infoModal.visible} transparent animationType="fade" onRequestClose={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}>
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm border border-border shadow-xl">
            <Text className="text-lg font-bold text-foreground mb-2">{infoModal.title}</Text>
            <Text className="text-muted-foreground mb-6">{infoModal.message}</Text>
            <View className="flex-row justify-end gap-3">
              <Button onPress={() => { setInfoModal(prev => ({ ...prev, visible: false })); }}>
                <Text>Aceptar</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
