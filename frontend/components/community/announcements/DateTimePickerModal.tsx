import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
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

  // Editable text states for the time inputs
  const [hourText, setHourText] = useState(pad(parsedDate?.getHours() ?? 10));
  const [minuteText, setMinuteText] = useState(pad(parsedDate?.getMinutes() ?? 0));

  // When the modal opens, sync with the current value
  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setSelectedDay(d.getDate());
      setHourText(pad(d.getHours()));
      setMinuteText(pad(d.getMinutes()));
    }
  }, [visible, value]);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Ensure selected day is valid for the current month
  const validDay = Math.min(selectedDay, daysInMonth);

  const handleHourChange = (text: string) => {
    setHourText(text);
  };

  const handleHourBlur = () => {
    const num = parseInt(hourText, 10);
    const clamped = isNaN(num) ? 0 : Math.min(23, Math.max(0, num));
    setHourText(pad(clamped));
  };

  const handleMinuteChange = (text: string) => {
    setMinuteText(text);
  };

  const handleMinuteBlur = () => {
    const num = parseInt(minuteText, 10);
    const clamped = isNaN(num) ? 0 : Math.min(59, Math.max(0, num));
    setMinuteText(pad(clamped));
  };

  const handleConfirm = () => {
    // Commit any pending text values before confirming
    const h = Math.min(23, Math.max(0, parseInt(hourText, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minuteText, 10) || 0));
    const date = new Date(selectedYear, selectedMonth, validDay, h, m);
    if (date < new Date()) {
      Alert.alert('Fecha inválida', 'La fecha seleccionada debe ser futura.');
      return;
    }
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

  const previewDate = new Date(selectedYear, selectedMonth, validDay, parseInt(hourText, 10) || 0, parseInt(minuteText, 10) || 0);
  const isPast = previewDate < new Date();

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => { if (!disabled) setVisible(true); }}
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
        onRequestClose={() => { setVisible(false); }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-5 w-full max-w-sm border border-border shadow-2xl">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold text-foreground">Fecha y Hora</Text>
              <TouchableOpacity onPress={() => { setVisible(false); }} className="p-1">
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
                      onPress={() => { setSelectedMonth(idx); }}
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
                    onPress={() => { setSelectedYear(year); }}
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
                    onPress={() => { setSelectedDay(day); }}
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

            {/* Time Input — Hour : Minute */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Hora</Text>
              <View className="flex-row items-center gap-2">
                {/* Hour input */}
                <View className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
                  <TextInput
                    value={hourText}
                    onChangeText={handleHourChange}
                    onBlur={handleHourBlur}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: Platform.OS === 'web' ? 10 : 12,
                      fontSize: 20,
                      fontWeight: '700',
                      textAlign: 'center',
                      color: 'inherit',
                    }}
                  />
                </View>
                <Text className="text-2xl font-bold text-foreground">:</Text>
                {/* Minute input */}
                <View className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
                  <TextInput
                    value={minuteText}
                    onChangeText={handleMinuteChange}
                    onBlur={handleMinuteBlur}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: Platform.OS === 'web' ? 10 : 12,
                      fontSize: 20,
                      fontWeight: '700',
                      textAlign: 'center',
                      color: 'inherit',
                    }}
                  />
                </View>
              </View>
              <Text className="text-[11px] text-muted-foreground mt-1 px-1">Introduce la hora en formato 24h (00-23) y los minutos (00-59).</Text>
            </View>

            {/* Preview & Validation */}
            <View className={`rounded-xl p-3 mb-5 items-center ${isPast
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-indigo-50 dark:bg-indigo-900/20'
            }`}>
              <Text className={`font-bold text-base ${isPast
                ? 'text-red-700 dark:text-red-400'
                : 'text-indigo-700 dark:text-indigo-400'
              }`}>
                {pad(validDay)}/{pad(selectedMonth + 1)}/{selectedYear} — {hourText.padStart(2, '0')}:{minuteText.padStart(2, '0')}
              </Text>
              {isPast && (
                <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-semibold">
                  ⚠️ La fecha debe ser futura
                </Text>
              )}
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
                className={`flex-1 ${isPast
                  ? 'bg-slate-300 dark:bg-slate-700'
                  : 'bg-indigo-600 dark:bg-indigo-500'
                }`}
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
