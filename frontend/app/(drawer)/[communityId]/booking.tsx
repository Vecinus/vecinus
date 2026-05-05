import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, useFocusEffect } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CustomAlertDialog, AlertConfig, CustomAlertDeleteDialog } from '@/components/custom-alert';

import { ReservasHeader } from '../../../components/booking/booking-header';
import { TimeSlotsGrid } from '../../../components/booking/time-slots-grid';
import { WorkerView } from '@/components/booking/worker-view';

import { useRole } from '@/hooks/useRole';
import { CommonSpace, commonSpaceApi } from '@/api/commonSpace';
import { bookingApi } from '@/api/booking';
import { useAuth } from '@/context/AuthContext';
import { guestPassApi } from '@/api/guestPass';

// IMPORTAMOS LOS COMPONENTES DEL SELECT
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
  monthNamesShort: [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

// Genera los slots basados en el horario de la zona
const GENERATE_BASE_SLOTS = (startTime?: string, endTime?: string) => {
  if (!startTime || !endTime) return [];

  const startHour = parseInt(startTime.split(':')[0], 10);
  const parsedEnd = parseInt(endTime.split(':')[0], 10);

  // Si la hora de cierre es medianoche (00:00), calculamos hasta las 24
  const endHour = parsedEnd === 0 ? 24 : parsedEnd;
  const length = Math.max(0, endHour - startHour);

  return Array.from({ length }, (_, i) => {
    const hour = i + startHour;
    return `${hour.toString().padStart(2, '0')}:00`;
  });
};

export default function Reservas() {
  const router = useRouter();
  const currentRole = useRole();
  const isWorker = currentRole === 5;
  const isAdminOrPresident = currentRole === 1 || currentRole === 4;
  const { activeCommunity } = useAuth();
  const associationId = activeCommunity ? activeCommunity.id : '';

  const [zonas, setZonas] = useState<CommonSpace[]>([]);
  const [zonaActivaId, setZonaActivaId] = useState<number | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [slotsDisponibles, setSlotsDisponibles] = useState<
    { time: string; isBooked: boolean; isPast: boolean }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingZone, setIsDeletingZone] = useState(false);
  const [lastActionWasDelete, setLastActionWasDelete] = useState(false);
  const [guestPassCount, setGuestPassCount] = useState(1);

  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });

  const esModoExclusivo = (zona: CommonSpace | undefined): boolean => {
    return zona?.usage_mode === 'exclusive_reservation';
  };

  const fetchZonas = useCallback(async () => {
    try {
      const data = await commonSpaceApi.listCommonSpaces(associationId);
      setZonas(data);

      setZonaActivaId((prevId) => {
        if (prevId && data.some((z) => z.id === prevId)) {
          return prevId;
        }
        return data.length > 0 ? data[0].id : null;
      });
    } catch {
      // Manejo silencioso de error en consola si se desea
    }
  }, [associationId]);

  useEffect(() => {
    if (associationId) {
      void fetchZonas();
    }
  }, [associationId, fetchZonas]);

  useFocusEffect(
    useCallback(() => {
      if (associationId) {
        fetchZonas();
      }
    }, [associationId, fetchZonas])
  );

  const fetchSlots = useCallback(async () => {
    if (!zonaActivaId || !fechaSeleccionada) {
      setSlotsDisponibles([]);
      return;
    }

    const zonaActual = zonas.find((z) => z.id === zonaActivaId);

    if (!zonaActual?.start_time || !zonaActual?.end_time) {
      setSlotsDisponibles([]);
      return;
    }

    setIsLoadingSlots(true);

    try {
      const baseSlots = GENERATE_BASE_SLOTS(zonaActual.start_time, zonaActual.end_time);

      if (baseSlots.length === 0) {
        setSlotsDisponibles([]);
        return;
      }

      const occupiedSlots = await bookingApi.listOccupiedSlots(zonaActivaId, fechaSeleccionada);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const isToday = fechaSeleccionada === todayStr;
      const currentHour = now.getHours();

      const newSlots = baseSlots.map((time) => {
        const isBooked = occupiedSlots.some((slot) => {
          const slotStartDate = new Date(slot.start_at);
          const slotHourStr = `${slotStartDate.getHours().toString().padStart(2, '0')}:00`;
          return slotHourStr === time;
        });

        const slotHour = parseInt(time.split(':')[0], 10);
        const isPast = isToday && slotHour <= currentHour;

        return { time, isBooked, isPast };
      });

      setSlotsDisponibles(newSlots);

      const isValidTime = newSlots.some(s => s.time === horaSeleccionada && !s.isBooked && !s.isPast);
      if (!isValidTime) {
        setHoraSeleccionada('');
      }

    } catch {
      setSlotsDisponibles([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [fechaSeleccionada, zonaActivaId, zonas, horaSeleccionada]);

  useEffect(() => {
    void fetchSlots();
  }, [fetchSlots]);

  const zonaActiva = zonas.find((z) => z.id === zonaActivaId);

  const handleReservar = async () => {
    if (!zonaActivaId || !fechaSeleccionada) return;

    try {
      setIsSubmitting(true);
      const esExclusivo = esModoExclusivo(zonaActiva);

      if (esExclusivo) {
        if (!horaSeleccionada) return;
        const startAt = new Date(`${fechaSeleccionada}T${horaSeleccionada}:00`);
        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

        await bookingApi.createReservation({
          space_id: zonaActivaId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          guests_count: 0,
        });

        await fetchSlots();

        setAlertConfig({
          visible: true,
          title: '¡Reserva Confirmada!',
          message: 'Tu reserva se ha creado correctamente.',
          type: 'success',
        });
      } else {
        const promises = Array.from({ length: guestPassCount }, () =>
          guestPassApi.createGuestPass({
            space_id: zonaActivaId,
            valid_for_date: fechaSeleccionada,
          })
        );
        await Promise.all(promises);

        setAlertConfig({
          visible: true,
          title: guestPassCount > 1 ? '¡Pases Generados!' : '¡Pase Generado!',
          message:
            guestPassCount > 1
              ? `Se han generado ${guestPassCount} pases de invitado correctamente.`
              : 'El pase de invitado se ha generado correctamente.',
          type: 'success',
        });
        setGuestPassCount(1);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } }; message?: string };
      const errorMessage = err.response?.data?.detail
        || err.message
        || 'No se pudo completar la acción. Inténtalo de nuevo.';

      setAlertConfig({
        visible: true,
        title: 'Error',
        message: errorMessage,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlertConfirm = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
    if (alertConfig.type === 'success' && !lastActionWasDelete) {
      router.push(`/${associationId}/mis-reservas`);
    }
  };

  const handleDeleteAlertConfirm = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
    setLastActionWasDelete(false);
    if (alertConfig.type === 'success') {
      router.push(`/${associationId}/booking`);
    }
  };

  const handleDeleteZone = async () => {
    if (!zonaActivaId) return;

    try {
      setIsDeletingZone(true);
      await commonSpaceApi.deleteCommonSpace(associationId, zonaActivaId);
      setDeleteDialogOpen(false);

      setLastActionWasDelete(true);
      setAlertConfig({
        visible: true,
        title: '¡Zona Eliminada!',
        message: 'La zona común se ha eliminado correctamente.',
        type: 'success',
      });

      await fetchZonas();
    } catch {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'No se pudo eliminar la zona. Inténtalo de nuevo.',
        type: 'error',
      });
    } finally {
      setIsDeletingZone(false);
    }
  };

  const selectedSlot = slotsDisponibles.find((s) => s.time === horaSeleccionada);
  const isSelectedSlotUnavailable = selectedSlot?.isBooked || selectedSlot?.isPast;

  if (isWorker) {
    return <WorkerView zonas={zonas} zonaActivaId={zonaActivaId} onSelectZona={setZonaActivaId} />;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pt-6 pb-28">
        <ReservasHeader
          isAdminOrPresident={isAdminOrPresident}
          isWorker={isWorker}
          associationId={associationId}
        />

        <View className="z-50 mb-6">
          <Text className="mb-2 px-1 text-sm font-medium text-muted-foreground">Instalación:</Text>
          <Select
            value={
              zonaActiva ? { label: zonaActiva.name, value: zonaActiva.id.toString() } : undefined
            }
            onValueChange={(option) => { if (option) setZonaActivaId(Number(option.value)); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una instalación" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {zonas.map((zona) => (
                  <SelectItem key={zona.id} label={zona.name} value={zona.id.toString()}>
                    {zona.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </View>

        {isAdminOrPresident && zonaActiva && (
          <View className="mb-4 flex-row items-center justify-between px-1">
            <Text className="text-sm font-medium text-muted-foreground">Administración:</Text>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-primary bg-blue-50/50"
                onPress={() => {
                  router.push(`/${associationId}/editar-zona?zona_id=${zonaActivaId}`);
                }}>
                <Text className="text-xs font-bold text-primary">Editar</Text>
              </Button>
              <Button variant="destructive" size="sm" onPress={() => { setDeleteDialogOpen(true); }}>
                <Text className="text-xs font-bold text-destructive-foreground">Eliminar</Text>
              </Button>
            </View>
          </View>
        )}

        {zonaActiva && (
          <View className="mb-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <Calendar
              key={zonaActiva.id}
              theme={{
                calendarBackground: 'transparent',
                selectedDayBackgroundColor: '#3b82f6',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#3b82f6',
                todayBackgroundColor: 'rgba(59, 130, 246, 0.08)',
                arrowColor: '#3b82f6',
                dayTextColor: '#1f2937',
                textDisabledColor: '#d1d5db',
                textDayFontWeight: '500',
                textDayHeaderFontWeight: '700',
                textDayHeaderFontSize: 13,
                textDayFontSize: 15,
                textMonthFontWeight: '700',
                textMonthFontSize: 17,
                monthTextColor: '#111827',
              }}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={(day: { dateString: string }) => { setFechaSeleccionada(day.dateString); }}
              markedDates={{
                [fechaSeleccionada]: {
                  selected: true,
                  selectedColor: '#3b82f6',
                  selectedTextColor: '#ffffff',
                },
              }}
              enableSwipeMonths={true}
            />
          </View>
        )}

        {Boolean(fechaSeleccionada) && esModoExclusivo(zonaActiva) && (
          <View className="mt-4">
            {isLoadingSlots ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="mt-4 text-sm font-medium text-muted-foreground">
                  Comprobando horarios...
                </Text>
              </View>
            ) : slotsDisponibles.length > 0 ? (
              <TimeSlotsGrid
                slots={slotsDisponibles}
                horaSeleccionada={horaSeleccionada}
                onSelectTime={setHoraSeleccionada}
              />
            ) : (
              <View className="py-6 items-center justify-center">
                <Text className="text-center text-sm font-medium text-muted-foreground">
                  No hay horarios configurados o válidos para esta instalación.
                </Text>
              </View>
            )}
          </View>
        )}

        {Boolean(fechaSeleccionada) &&
          zonaActiva &&
          !esModoExclusivo(zonaActiva) &&
          (() => {
            const maxPases = zonaActiva.max_guests_per_reservation ?? 1;
            return (
              <View className="mb-4 mt-2">
                <Text className="mb-1 text-base font-semibold text-foreground">
                  Cantidad de pases
                </Text>
                <Text className="mb-3 text-xs text-muted-foreground">
                  Máximo {maxPases} {maxPases === 1 ? 'invitado' : 'invitados'} por día en esta zona
                </Text>
                <View className="flex-row items-center justify-center gap-4">
                  <TouchableOpacity
                    onPress={() => { setGuestPassCount(Math.max(1, guestPassCount - 1)); }}
                    disabled={guestPassCount <= 1}
                    className={`h-12 w-12 items-center justify-center rounded-full border ${guestPassCount <= 1
                      ? 'border-border bg-muted'
                      : 'border-primary bg-primary/10'
                      }`}>
                    <Text
                      style={{ lineHeight: 28, textAlign: 'center', includeFontPadding: false }}
                      className={`text-2xl font-bold ${guestPassCount <= 1 ? 'text-muted-foreground' : 'text-primary'
                        }`}>
                      −
                    </Text>
                  </TouchableOpacity>

                  <View className="w-16 items-center">
                    <Text className="text-3xl font-bold text-foreground">{guestPassCount}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {guestPassCount === 1 ? 'pase' : 'pases'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => { setGuestPassCount(Math.min(maxPases, guestPassCount + 1)); }}
                    disabled={guestPassCount >= maxPases}
                    className={`h-12 w-12 items-center justify-center rounded-full border ${guestPassCount >= maxPases
                      ? 'border-border bg-muted'
                      : 'border-primary bg-primary/10'
                      }`}>
                    <Text
                      style={{ lineHeight: 28, textAlign: 'center', includeFontPadding: false }}
                      className={`text-2xl font-bold ${guestPassCount >= maxPases ? 'text-muted-foreground' : 'text-primary'
                        }`}>
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/90 p-5">
        <Button
          className="h-14 rounded-2xl"
          onPress={handleReservar}
          disabled={
            isSubmitting ||
            isLoadingSlots ||
            (esModoExclusivo(zonaActiva) && (isSelectedSlotUnavailable || !horaSeleccionada)) ||
            !zonaActivaId
          }>
          <Text className="text-lg font-bold text-primary-foreground">
            {isSubmitting
              ? 'Procesando...'
              : !esModoExclusivo(zonaActiva)
                ? guestPassCount > 1
                  ? `Generar ${guestPassCount} Pases de Invitado`
                  : 'Generar Pase de Invitado'
                : horaSeleccionada ? `Reservar (${horaSeleccionada})` : 'Selecciona una hora'}
          </Text>
        </Button>
      </View>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={() => { }}
        onCancel={() => { setAlertConfig((prev) => ({ ...prev, visible: false })); }}
        onAcknowledge={lastActionWasDelete ? handleDeleteAlertConfirm : handleAlertConfirm}
      />

      <CustomAlertDeleteDialog
        visible={deleteDialogOpen}
        title="Eliminar Zona Común"
        message={`¿Estás seguro de que deseas eliminar permanentemente "${zonaActiva?.name}"? Esta acción borrará el calendario y no se puede deshacer.`}
        onCancel={() => { setDeleteDialogOpen(false); }}
        onConfirm={handleDeleteZone}
        isLoading={isDeletingZone}
      />
    </View>
  );
}