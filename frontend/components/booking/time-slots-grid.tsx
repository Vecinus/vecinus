import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';

interface Slot {
  time: string;
  isBooked: boolean;
  isPast?: boolean;
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
      <View className="flex-row flex-wrap justify-center gap-2.5">
        {slots.map((slot, index) => {
          const isDisabled = slot.isBooked || !!slot.isPast;
          const isSelected = horaSeleccionada === slot.time && !isDisabled;

          return (
            <TouchableOpacity
              key={index}
              disabled={isDisabled}
              onPress={() => onSelectTime(slot.time)}
              className={`w-[30%] py-3 rounded-xl items-center border ${isDisabled
                ? 'bg-muted border-border opacity-50'
                : isSelected
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
                }`}
            >
              <Text className={`text-base font-bold ${isDisabled
                ? 'text-muted-foreground line-through'
                : isSelected
                  ? 'text-primary-foreground'
                  : 'text-foreground'
                }`}>
                {slot.time}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}