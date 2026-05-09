import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { type Announcement } from '@/api/announcements';

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress: () => void;
  onDelete?: () => void;
  canManage: boolean;
}

export function AnnouncementCard({ announcement, onPress, onDelete, canManage }: AnnouncementCardProps) {
  const isDraft = announcement.status === 'DRAFT';

  const dateStr = new Date(announcement.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = new Date(announcement.created_at).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      className="bg-card rounded-2xl mb-4 overflow-hidden shadow-sm border border-border"
    >
      {/* Administrative Action: Delete Button (Top Right) */}
      {canManage && onDelete && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          accessibilityLabel="Eliminar anuncio"
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-red-500/90 items-center justify-center shadow-sm"
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={15} color="white" />
        </TouchableOpacity>
      )}

      {/* Image banner - Only show if there is an image */}
      {announcement.image_url ? (
        <View className="w-full h-40 sm:h-48 bg-muted relative">
          <Image
            source={{ uri: announcement.image_url }}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <View className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </View>
      ) : null}

      {/* Overlays / Badges */}
      <View className="absolute top-3 left-3 z-20 flex-row gap-2">
        {/* Status badge */}
        <View className={`px-2.5 py-1 rounded-full shadow-sm ${isDraft
          ? 'bg-amber-500/95'
          : 'bg-emerald-500/95'
          }`}>
          <Text className="text-white text-[10px] font-bold uppercase tracking-wide">
            {isDraft ? 'Borrador' : 'Publicado'}
          </Text>
        </View>

        {/* Scheduled indicator */}
        {announcement.scheduled_date && (
          <View className="bg-indigo-500/95 px-2 py-1 rounded-full shadow-sm flex-row items-center gap-1">
            <Ionicons name="time-outline" size={10} color="white" />
            <Text className="text-white text-[10px] font-bold uppercase">Programado</Text>
          </View>
        )}
      </View>

      {/* Content section */}
      <View className="p-4">
        {/* Extra spacing if no image to avoid overlap with absolute badges */}
        {!announcement.image_url && <View className="h-6" />}

        <Text className="font-bold text-lg text-foreground mb-1.5 leading-snug" numberOfLines={2}>
          {announcement.title}
        </Text>

        <Text className="text-sm text-muted-foreground leading-5 mb-3" numberOfLines={2}>
          {announcement.content}
        </Text>

        {/* Footer */}
        <View className="flex-row items-center justify-between pt-2.5 border-t border-border/50">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="calendar-outline" size={13} color="#6366f1" />
            <Text className="text-xs text-muted-foreground">
              {dateStr} · {timeStr}
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Leer más</Text>
            <Ionicons name="chevron-forward" size={14} color="#6366f1" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
