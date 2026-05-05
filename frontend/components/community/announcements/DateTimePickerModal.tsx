import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@expo/vector-icons';

interface DateTimePickerModalProps {
  value: string; // ISO string or empty
  onChange: (isoString: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function DateTimePickerModal({
  value,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar fecha y hora',
}: DateTimePickerModalProps) {
  const [visible, setVisible] = useState(false);

  // Parse the current value into parts
  const parsedDate = value ? new Date(value) : null;
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(parsedDate?.getFullYear() ?? now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(parsedDate?.getMonth() ?? now.getMonth());
  const [selectedDay, setSelectedDay] = useState(parsedDate?.getDate() ?? now.getDate());
  const [selectedHour, setSelectedHour] = useState(parsedDate?.getHours() ?? 10);
  const [selectedMinute, setSelectedMinute] = useState(parsedDate?.getMinutes() ?? 0);

  // When the modal opens, sync with the current value
  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setSelectedDay(d.getDate());
      setSelectedHour(d.getHours());
      setSelectedMinute(d.getMinutes());
    }
  }, [visible, value]);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Ensure selected day is valid for the current month
  const validDay = Math.min(selectedDay, daysInMonth);

  const handleConfirm = () => {
    const date = new Date(selectedYear, selectedMonth, validDay, selectedHour, selectedMinute);
    onChange(date.toISOString());
    setVisible(false);
  };

  const handleClear = () => {
    onChange('');
    setVisible(false);
  };

  const displayText = parsedDate
    ? parsedDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : placeholder;

  // Generate arrays for selectors
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        className="flex-row items-center px-4 py-3 rounded-xl border border-border bg-card mb-4"
      >
        <Ionicons name="calendar-outline" size={20} color="#6366f1" />
        <Text
          className={`ml-3 flex-1 ${parsedDate ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={16} className="text-muted-foreground" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-5 w-full max-w-sm border border-border shadow-2xl">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold text-foreground">Fecha y Hora</Text>
              <TouchableOpacity onPress={() => setVisible(false)} className="p-1">
                <Ionicons name="close" size={22} className="text-muted-foreground" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Row */}
            <View className="flex-row gap-3 mb-4">
              {/* Month Selector */}
              <View className="flex-1">
                <Text className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Mes</Text>
                <View className="flex-row flex-wrap gap-1">
                  {MONTHS.map((monthName, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedMonth(idx)}
                      className={`px-2 py-1.5 rounded-lg ${selectedMonth === idx
                        ? 'bg-indigo-600'
                        : 'bg-accent/50'
                        }`}
                    >
                      <Text
                        className={`text-xs font-medium ${selectedMonth === idx ? 'text-white' : 'text-foreground'
                          }`}
                      >
                        {monthName.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Year Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Año</Text>
              <View className="flex-row gap-2">
                {years.map((year) => (
                  <TouchableOpacity
                    key={year}
                    onPress={() => setSelectedYear(year)}
                    className={`flex-1 py-2 rounded-lg items-center ${selectedYear === year
                      ? 'bg-indigo-600'
                      : 'bg-accent/50'
                      }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${selectedYear === year ? 'text-white' : 'text-foreground'
                        }`}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Day Selector */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Día</Text>
              <View className="flex-row flex-wrap gap-1">
                {days.map((day) => (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    className={`w-9 h-9 rounded-lg items-center justify-center ${validDay === day
                      ? 'bg-indigo-600'
                      : 'bg-accent/50'
                      }`}
                  >
                    <Text
                      className={`text-sm font-medium ${validDay === day ? 'text-white' : 'text-foreground'
                        }`}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time Selector */}
            <View className="flex-row gap-4 mb-6">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Hora</Text>
                <View className="flex-row flex-wrap gap-1">
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      onPress={() => setSelectedHour(h)}
                      className={`w-9 h-8 rounded-md items-center justify-center ${selectedHour === h
                        ? 'bg-indigo-600'
                        : 'bg-accent/50'
                        }`}
                    >
                      <Text
                        className={`text-xs font-medium ${selectedHour === h ? 'text-white' : 'text-foreground'
                          }`}
                      >
                        {pad(h)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Minuto</Text>
              <View className="flex-row flex-wrap gap-1">
                {minutes.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setSelectedMinute(m)}
                    className={`px-3 h-8 rounded-md items-center justify-center ${selectedMinute === m
                      ? 'bg-indigo-600'
                      : 'bg-accent/50'
                      }`}
                  >
                    <Text
                      className={`text-xs font-medium ${selectedMinute === m ? 'text-white' : 'text-foreground'
                        }`}
                    >
                      {pad(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preview */}
            <View className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mb-5 items-center">
              <Text className="text-indigo-700 dark:text-indigo-400 font-bold text-base">
                {pad(validDay)}/{pad(selectedMonth + 1)}/{selectedYear} — {pad(selectedHour)}:{pad(selectedMinute)}
              </Text>
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={handleClear}
              >
                <Text className="text-muted-foreground">Limpiar</Text>
              </Button>
              <Button
                className="flex-1 bg-indigo-600 dark:bg-indigo-500"
                onPress={handleConfirm}
              >
                <Text className="text-white font-semibold">Confirmar</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
