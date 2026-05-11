import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleProp,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Camera } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { getLegalWarning } from '@/utils/legal-warnings';
import { INCIDENT_TYPE_LABEL, INCIDENT_TYPES, type IncidentType } from '@/api/incidents';

const INCIDENT_TYPE_OPTIONS: IncidentType[] = [
  INCIDENT_TYPES.LIGHTING,
  INCIDENT_TYPES.ELECTRICITY,
  INCIDENT_TYPES.ELEVATOR,
  INCIDENT_TYPES.PLUMBING,
  INCIDENT_TYPES.SAFETY,
  INCIDENT_TYPES.WORKERS,
  INCIDENT_TYPES.POOL,
  INCIDENT_TYPES.OTHER,
];

interface IncidentCreateModalProps {
  visible: boolean;
  typeDraft: IncidentType | '';
  setTypeDraft: (type: IncidentType | '') => void;
  descriptionDraft: string;
  setDescriptionDraft: (desc: string) => void;
  pickedImage: { uri: string; name?: string | null; mimeType?: string | null; file?: unknown } | null;
  formError: string;
  setFormError: (error: string) => void;
  isPending: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onSubmit: () => void;
  modalCardStyle: StyleProp<ViewStyle>;
}

export function IncidentCreateModal({
  visible,
  typeDraft,
  setTypeDraft,
  descriptionDraft,
  setDescriptionDraft,
  pickedImage,
  formError,
  setFormError,
  isPending,
  onClose,
  onPickImage,
  onSubmit,
  modalCardStyle,
}: IncidentCreateModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/45 px-6">
        <ScrollView
          className="max-h-[85%]"
          contentContainerStyle={{ paddingVertical: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-card rounded-3xl p-6 border border-border shadow-lg" style={modalCardStyle}>
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reportar Incidencia</Text>
            <Text className="text-sm text-slate-500 dark:text-zinc-300 mb-5">
              Describe el problema para que el equipo lo revise cuanto antes.
            </Text>

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Tipo</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {INCIDENT_TYPE_OPTIONS.map((typeOption) => {
                const selected = typeDraft === typeOption;
                return (
                  <TouchableOpacity
                    key={typeOption}
                    className={`px-3 py-2 rounded-lg border ${
                      selected ? 'bg-emerald-500 border-emerald-500' : 'bg-card border-border'
                    }`}
                    activeOpacity={0.8}
                    onPress={() => {
                      setTypeDraft(typeOption);
                      setFormError('');
                    }}
                  >
                    <Text
                      className={`font-semibold text-xs ${
                        selected ? 'text-primary-foreground' : 'text-slate-700 dark:text-zinc-200'
                      }`}
                    >
                      {INCIDENT_TYPE_LABEL[typeOption] /* nosemgrep */}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Descripcion</Text>
            <TextInput
              value={descriptionDraft}
              onChangeText={(text) => {
                setDescriptionDraft(text);
                if (formError) setFormError('');
              }}
              placeholder="Describe con detalle lo que ha pasado..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              className="rounded-xl bg-muted border border-border px-4 py-3 min-h-[110px] text-foreground mb-4"
            />

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Fotografia (opcional)</Text>
            <Text className="mb-2 text-xs italic text-muted-foreground">
              {getLegalWarning('image_upload')}
            </Text>
            <TouchableOpacity
              className="h-12 rounded-xl bg-muted border border-border px-4 mb-2 flex-row items-center"
              onPress={onPickImage}
              activeOpacity={0.8}
            >
              <Camera size={18} color="#64748b" />
              <Text className="ml-2 text-slate-700 dark:text-zinc-200" numberOfLines={1}>
                {pickedImage?.name || 'Seleccionar imagen'}
              </Text>
            </TouchableOpacity>
            {pickedImage?.uri ? (
              <Image source={{ uri: pickedImage.uri }} className="h-28 rounded-xl mt-1 mb-3" resizeMode="cover" />
            ) : null}

            {!!formError && (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 p-3 mb-4">
                <Text className="text-red-600 dark:text-red-400 font-semibold text-xs">{formError}</Text>
              </View>
            )}

            <View className="flex-row gap-3 mt-1">
              <Button variant="outline" className="flex-1 h-12" onPress={onClose} disabled={isPending}>
                <Text className="font-semibold text-foreground">Cancelar</Text>
              </Button>
              <Button className="flex-1 h-12" onPress={onSubmit} disabled={isPending}>
                {isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white">Enviar</Text>}
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
