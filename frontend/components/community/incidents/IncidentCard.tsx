import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, type Incident } from '@/api/incidents';
import { STATUS_TONE, STATUS_ICON, TYPE_META, formatDate } from '@/components/community/incidents/constants';

interface IncidentCardProps {
  incident: Incident;
  reporterText: string;
  canManageStatus: boolean;
  onPress: () => void;
}

export function IncidentCard({ incident, reporterText, canManageStatus, onPress }: IncidentCardProps) {
  const tone = STATUS_TONE[incident.status];
  const StatusIcon = STATUS_ICON[incident.status];
  const typeMeta = TYPE_META[incident.type];
  const TypeIcon = typeMeta.icon;

  return (
    <TouchableOpacity
      className="bg-card border border-border rounded-2xl p-4 mb-3 shadow-sm"
      activeOpacity={0.9}
      onPress={onPress}
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
              {INCIDENT_TYPE_LABEL[incident.type]}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{formatDate(incident.createdAt)}</Text>
            <Text className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5" numberOfLines={1}>
              {reporterText}
            </Text>
          </View>
        </View>

        <View
          className="px-2.5 py-1 rounded-full border flex-row items-center"
          style={{ backgroundColor: tone.bg, borderColor: tone.border }}
        >
          <StatusIcon size={12} color={tone.text} />
          <Text className="ml-1 text-xs font-semibold" style={{ color: tone.text }}>
            {INCIDENT_STATUS_LABEL[incident.status]}
          </Text>
        </View>
      </View>

      <Text className="text-slate-700 dark:text-zinc-200 mt-3 leading-5" numberOfLines={3}>
        {incident.description}
      </Text>

      <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
        {canManageStatus
          ? 'Pulsa para ver detalle y cambiar estado.'
          : 'Pulsa para ver detalle de la incidencia.'}
      </Text>
    </TouchableOpacity>
  );
}
