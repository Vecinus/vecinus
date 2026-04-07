import React from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, type Incident, type IncidentStatus } from '@/api/incidents';
import { STATUS_TONE, STATUS_ICON, formatDate, formatDateTime } from './constants';

interface IncidentDetailModalProps {
  visible: boolean;
  selectedIncident: Incident | null;
  getReporterText: (incident: Incident) => string;
  isDesktop: boolean;
  detailImageStyle: any;
  modalCardStyle: any;
  selectedIncidentTransitions: IncidentStatus[];
  canManageStatus: boolean;
  draftStatus: IncidentStatus;
  setDraftStatus: (status: IncidentStatus) => void;
  incidentHistory: { status: IncidentStatus; date: string }[];
  canDiscardSelectedIncident: boolean;
  isSelectedIncidentReviewed: boolean;
  isPending: boolean;
  onClose: () => void;
  onSaveStatus: () => void;
  onDiscardIncident: () => void;
}

export function IncidentDetailModal({
  visible,
  selectedIncident,
  getReporterText,
  isDesktop,
  detailImageStyle,
  modalCardStyle,
  selectedIncidentTransitions,
  canManageStatus,
  draftStatus,
  setDraftStatus,
  incidentHistory,
  canDiscardSelectedIncident,
  isSelectedIncidentReviewed,
  isPending,
  onClose,
  onSaveStatus,
  onDiscardIncident,
}: IncidentDetailModalProps) {
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
            {!selectedIncident ? (
              <View className="items-center py-10">
                <ActivityIndicator color="#4f46e5" />
                <Text className="mt-3 text-slate-500 dark:text-zinc-400">Cargando detalle...</Text>
              </View>
            ) : (
              <>
                <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {INCIDENT_TYPE_LABEL[selectedIncident.type]}
                </Text>
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

                <Text className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Estado</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {selectedIncidentTransitions.length > 0 && canManageStatus
                    ? [selectedIncident.status, ...selectedIncidentTransitions].map((statusOption, index, array) => {
                        if (array.indexOf(statusOption) !== index) return null;
                        const selected = draftStatus === statusOption;
                        return (
                          <TouchableOpacity
                            key={statusOption}
                            className={`px-3 py-2 rounded-lg border ${
                              selected ? 'bg-primary border-primary' : 'bg-muted border-border'
                            }`}
                            onPress={() => setDraftStatus(statusOption)}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                selected ? 'text-white' : 'text-slate-700 dark:text-zinc-200'
                              }`}
                            >
                              {INCIDENT_STATUS_LABEL[statusOption]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    : (
                      <View
                        className="px-3 py-2 rounded-lg border"
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

                <Text className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Historial</Text>
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
                    onPress={onClose}
                    disabled={isPending}
                  >
                    <Text className="font-semibold text-foreground">Cerrar</Text>
                  </Button>

                  {canManageStatus && selectedIncidentTransitions.length > 0 ? (
                    <Button
                      className="flex-1 h-12"
                      onPress={onSaveStatus}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white">Guardar</Text>
                      )}
                    </Button>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
