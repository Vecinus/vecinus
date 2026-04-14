import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { FileText, ChevronRight } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { MinutesReadResponse } from '@/types/minutes.types';

interface ActaListItemProps {
  acta: MinutesReadResponse;
  onPress: () => void;
}

export function ActaListItem({ acta, onPress }: ActaListItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="mb-2">
      <Card className="border-border">
        <CardContent className="p-3">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0 border border-primary/20">
              <Icon as={FileText} size={20} className="text-primary" />
            </View>
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-0.5">
                <Text className="font-bold text-base text-foreground flex-1 pr-2" numberOfLines={1}>
                  {acta.title}
                </Text>
                <Text className="text-[10px] font-medium text-muted-foreground">
                  {new Date(acta.scheduled_at).toLocaleDateString('es-ES')}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {acta.summary}
              </Text>
              <View className="flex-row items-center justify-between mt-1.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[10px] font-bold text-secondary uppercase">
                    {acta.meeting_type}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">•</Text>
                  <Text className="text-[10px] font-semibold text-primary/80">
                    {acta.agreements.length} acuerdos
                  </Text>
                </View>
                <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}