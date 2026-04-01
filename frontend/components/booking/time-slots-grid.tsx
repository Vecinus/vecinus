import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';

interface Slot {
  time: string;
  isBooked: boolean;
}

interface TimeSlotsGridProps {
  slots: Slot[];
  horaSeleccionada: string;
  onSelectTime: (time: string) => void;
}

export function TimeSlotsGrid({ slots, horaSeleccionada, onSelectTime }: TimeSlotsGridProps) {
  return (
    <View className="mt-2">
      <Text className="text-xl font-bold text-foreground mb-4">Horarios disponibles</Text>
      <View className="flex-row flex-wrap gap-2.5">
        {slots.map((slot, index) => (
          <TouchableOpacity
            key={index}
            disabled={slot.isBooked}
            onPress={() => onSelectTime(slot.time)}
            className={`w-[30%] py-3 rounded-xl items-center border ${
              slot.isBooked 
                ? 'bg-muted border-border' 
                : horaSeleccionada === slot.time 
                  ? 'bg-green-500 border-green-500' 
                  : 'bg-card border-primary'
            }`}
          >
            <Text className={`text-base font-bold ${
              slot.isBooked 
                ? 'text-muted-foreground line-through' 
                : horaSeleccionada === slot.time 
                  ? 'text-white' 
                  : 'text-primary'
            }`}>
              {slot.time}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}