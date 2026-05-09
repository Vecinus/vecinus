import React from 'react';
import { View, Modal, ScrollView, TouchableOpacity, Image, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AnnouncementStatus } from '@/api/announcements';
import { DateTimePickerModal } from './DateTimePickerModal';

interface AnnouncementCreateModalProps {
  visible: boolean;
  titleDraft: string;
  setTitleDraft: (text: string) => void;
  contentDraft: string;
  setContentDraft: (text: string) => void;
  statusDraft: AnnouncementStatus;
  setStatusDraft: (status: AnnouncementStatus) => void;
  scheduledDate: string;
  setScheduledDate: (date: string) => void;
  pickedImage: { uri: string; name?: string | null } | null;
  formError: string;
  setFormError: (err: string) => void;
  isPending: boolean;
  onClose: () => void;
  onPickImage: () => void;
  setPickedImage: (img: { uri: string; name?: string; mimeType?: string; file?: unknown } | null) => void;
  onSubmit: () => void;
  modalCardStyle: StyleProp<ViewStyle>;
}

export function AnnouncementCreateModal({
  visible,
  titleDraft,
  setTitleDraft,
  contentDraft,
  setContentDraft,
  statusDraft,
  setStatusDraft,
  scheduledDate,
  setScheduledDate,
  pickedImage,
  formError,
  setFormError,
  isPending,
  onClose,
  onPickImage,
  setPickedImage,
  onSubmit,
  modalCardStyle,
}: AnnouncementCreateModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end sm:justify-center p-0 sm:p-4">
        <View style={modalCardStyle} className="bg-background rounded-t-3xl sm:rounded-2xl h-[90%] sm:h-auto overflow-hidden shadow-2xl flex flex-col">
          <View className="px-5 py-4 border-b border-border flex-row items-center justify-between bg-card">
            <Text className="text-xl font-bold text-foreground">Crear Anuncio</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full hover:bg-accent">
              <Ionicons name="close" size={24} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {formError ? (
              <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/40">
                <Text className="text-red-600 dark:text-red-400 text-sm font-medium">{formError}</Text>
              </View>
            ) : null}

            <Text className="text-sm font-semibold text-foreground mb-2">Título *</Text>
            <Input
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="Ej: Reunión anual de vecinos..."
              className="mb-4"
              editable={!isPending}
            />

            <Text className="text-sm font-semibold text-foreground mb-2">Contenido *</Text>
            <Input
              value={contentDraft}
              onChangeText={setContentDraft}
              placeholder="Detalla el anuncio aquí..."
              multiline
              numberOfLines={6}
              className="h-32 mb-4"
              editable={!isPending}
            />

            <Text className="text-sm font-semibold text-foreground mb-2">Estado</Text>
            <View className="flex-row gap-3 mb-2">
              <TouchableOpacity
                onPress={() => { setStatusDraft('DRAFT'); }}
                className={`flex-1 py-3 rounded-xl border ${
                  statusDraft === 'DRAFT'
                    ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/20'
                    : 'bg-transparent border-border'
                }`}
              >
                <Text className={`text-center font-semibold ${statusDraft === 'DRAFT' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  Borrador
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => { setStatusDraft('PUBLISHED'); }}
                className={`flex-1 py-3 rounded-xl border ${
                  statusDraft === 'PUBLISHED'
                    ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20'
                    : 'bg-transparent border-border'
                }`}
              >
                <Text className={`text-center font-semibold ${statusDraft === 'PUBLISHED' ? 'text-indigo-700 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                  Publicado
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-[11px] text-muted-foreground mb-4 px-1">
              * {statusDraft === 'DRAFT' 
                ? 'Los borradores solo son visibles para administradores.' 
                : 'Los anuncios publicados son visibles para todos los vecinos.'}
            </Text>

            <Text className="text-sm font-semibold text-foreground mb-2">Fecha Programada (Opcional)</Text>
            <DateTimePickerModal
              value={scheduledDate}
              onChange={setScheduledDate}
              disabled={isPending}
              placeholder="Tocar para seleccionar fecha y hora"
            />

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Imagen (Opcional)</Text>
              {pickedImage && (
                <TouchableOpacity 
                  onPress={() => {
                    setPickedImage(null);
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
              onPress={onPickImage}
              disabled={isPending}
              className="mb-6 h-40 rounded-xl border-2 border-dashed border-border bg-accent/30 items-center justify-center overflow-hidden"
            >
              {pickedImage ? (
                <View className="w-full h-full relative">
                  <Image source={{ uri: pickedImage.uri }} className="w-full h-full" resizeMode="cover" />
                  <View className="absolute inset-0 bg-black/30 items-center justify-center">
                    <Ionicons name="camera" size={32} color="white" />
                    <Text className="text-white font-medium mt-2">Cambiar imagen</Text>
                  </View>
                </View>
              ) : (
                <View className="items-center">
                  <Ionicons name="image-outline" size={32} className="text-muted-foreground mb-2" />
                  <Text className="text-muted-foreground font-medium">Tocar para subir imagen</Text>
                  <Text className="text-xs text-muted-foreground mt-1">Máx. 5MB</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          <View className="p-5 bg-card border-t border-border flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onClose} disabled={isPending}>
              <Text>Cancelar</Text>
            </Button>
            <Button className="flex-1 bg-indigo-600 dark:bg-indigo-500" onPress={onSubmit} disabled={isPending}>
              <Text className="text-white">{isPending ? 'Guardando...' : 'Guardar'}</Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
