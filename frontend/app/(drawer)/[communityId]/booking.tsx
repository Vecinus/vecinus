import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView } from 'react-native';
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
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  monthNamesShort: [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

const GENERATE_BASE_SLOTS = () => {
  return Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8;
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
  const [horaSeleccionada, setHoraSeleccionada] = useState('10:00');
  const [slotsDisponibles, setSlotsDisponibles] = useState<{ time: string; isBooked: boolean }[]>(
    []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingZone, setIsDeletingZone] = useState(false);
  const [lastActionWasDelete, setLastActionWasDelete] = useState(false);

  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });

  const esModoExclusivo = (zona: CommonSpace | undefined): boolean => {
    if (!zona) return false;
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
    } catch (error) {
      console.error(error);
    }
  }, [associationId]);

  useEffect(() => {
    if (associationId) {
      fetchZonas();
    }
  }, [associationId, fetchZonas]);

  useFocusEffect(
    useCallback(() => {
      if (associationId) {
        fetchZonas();
      }
    }, [associationId, fetchZonas])
  );

  const fetchSlots = async () => {
    if (!zonaActivaId || !fechaSeleccionada) return;

    try {
      const baseSlots = GENERATE_BASE_SLOTS();
      const occupiedSlots = await bookingApi.listOccupiedSlots(zonaActivaId, fechaSeleccionada);

      const newSlots = baseSlots.map((time) => {
        const isBooked = occupiedSlots.some((slot) => {
          const slotStartDate = new Date(slot.start_at);
          const slotHourStr = `${slotStartDate.getHours().toString().padStart(2, '0')}:00`;
          return slotHourStr === time;
        });

        return { time, isBooked };
      });

      setSlotsDisponibles(newSlots);
    } catch (error) {
      console.error(error);
      setSlotsDisponibles(GENERATE_BASE_SLOTS().map((time) => ({ time, isBooked: false })));
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [zonaActivaId, fechaSeleccionada]);

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
        await guestPassApi.createGuestPass({
          space_id: zonaActivaId,
          valid_for_date: fechaSeleccionada,
        });

        setAlertConfig({
          visible: true,
          title: '¡Pase Generado!',
          message: 'El pase de invitado se ha generado correctamente.',
          type: 'success',
        });
      }
    } catch (error) {
      console.error(error);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'No se pudo completar la acción. Inténtalo de nuevo.',
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
    } catch (error) {
      console.error(error);
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

  const isSelectedSlotBooked = slotsDisponibles.find((s) => s.time === horaSeleccionada)?.isBooked;

  if (isWorker) {
    // Pasamos las zonas y la función de actualización al empleado
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

        {/* NUEVO SELECTOR PARA VECINOS */}
        <View className="z-50 mb-6">
          <Text className="mb-2 px-1 text-sm font-medium text-muted-foreground">Instalación:</Text>
          <Select
            value={
              zonaActiva ? { label: zonaActiva.name, value: zonaActiva.id.toString() } : undefined
            }
            onValueChange={(option) => option && setZonaActivaId(Number(option.value))}>
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
                onPress={() =>
                  router.push(`/${associationId}/editar-zona?zona_id=${zonaActivaId}`)
                }>
                <Text className="text-xs font-bold text-primary">Editar</Text>
              </Button>
              <Button variant="destructive" size="sm" onPress={() => setDeleteDialogOpen(true)}>
                <Text className="text-xs font-bold text-destructive-foreground">Eliminar</Text>
              </Button>
            </View>
          </View>
        )}

        {zonaActiva && (
          <View className="mb-6 overflow-hidden rounded-3xl border border-border bg-card p-3">
            <Calendar
              key={zonaActiva.id}
              theme={{
                calendarBackground: 'transparent',
                selectedDayBackgroundColor: '#0088CC',
                todayTextColor: '#88CC00',
                arrowColor: '#0088CC',
                textDayHeaderFontWeight: '600',
              }}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={(day: any) => setFechaSeleccionada(day.dateString)}
              markedDates={{ [fechaSeleccionada]: { selected: true, selectedColor: '#0088CC' } }}
            />
          </View>
        )}

        {Boolean(fechaSeleccionada) &&
          esModoExclusivo(zonaActiva) &&
          slotsDisponibles.length > 0 && (
            <TimeSlotsGrid
              slots={slotsDisponibles}
              horaSeleccionada={horaSeleccionada}
              onSelectTime={setHoraSeleccionada}
            />
          )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/90 p-5">
        <Button
          className="h-14 rounded-2xl bg-green-500"
          onPress={handleReservar}
          disabled={
            isSubmitting || (esModoExclusivo(zonaActiva) && isSelectedSlotBooked) || !zonaActivaId
          }>
          <Text className="text-lg font-bold text-white">
            {isSubmitting
              ? 'Procesando...'
              : !esModoExclusivo(zonaActiva)
                ? 'Generar Pase de Invitado'
                : `Reservar (${horaSeleccionada})`}
          </Text>
        </Button>
      </View>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={() => {}}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onAcknowledge={lastActionWasDelete ? handleDeleteAlertConfirm : handleAlertConfirm}
      />

      <CustomAlertDeleteDialog
        visible={deleteDialogOpen}
        title="Eliminar Zona Común"
        message={`¿Estás seguro de que deseas eliminar permanentemente "${zonaActiva?.name}"? Esta acción borrará el calendario y no se puede deshacer.`}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteZone}
        isLoading={isDeletingZone}
      />
    </View>
  );
}
