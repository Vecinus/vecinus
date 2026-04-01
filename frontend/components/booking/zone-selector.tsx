import React from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { CommonSpace } from '@/api/commonSpace';

interface ZoneSelectorProps {
  zonas: CommonSpace[];
  zonaActivaId: number | null; 
  onSelectZona: (id: number) => void; 
}

export function ZoneSelector({ zonas, zonaActivaId, onSelectZona }: ZoneSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-5">
      {zonas.map((zona) => (
        <TouchableOpacity
          key={zona.id}
          onPress={() => onSelectZona(zona.id)}
          className={`px-5 py-2.5 rounded-full mr-2.5 border ${
            zonaActivaId === zona.id 
              ? 'bg-primary border-primary' 
              : 'bg-card border-border'
          }`}
        >
          <Text className={`font-semibold text-base ${
            zonaActivaId === zona.id 
              ? 'text-primary-foreground' 
              : 'text-muted-foreground'
          }`}>
            {zona.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}