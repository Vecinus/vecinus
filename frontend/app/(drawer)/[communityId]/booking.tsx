import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native'; // Eliminado Alert de react-native
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
// Importamos los componentes de AlertDialog
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogAction 
} from "@/components/ui/alert-dialog";

import { ReservasHeader } from '../../../components/booking/booking-header';
import { ZoneSelector } from '../../../components/booking/zone-selector';
import { TimeSlotsGrid } from '../../../components/booking/time-slots-grid';
import { useRole } from '@/hooks/useRole';
import { CommonSpace, commonSpaceApi } from '@/api/commonSpace';
import { bookingApi } from '@/api/booking';
import { useAuth } from '@/context/AuthContext';
import { guestPassApi } from '@/api/guestPass';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
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
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0]);
  const [horaSeleccionada, setHoraSeleccionada] = useState('10:00');
  const [slotsDisponibles, setSlotsDisponibles] = useState<{ time: string; isBooked: boolean }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para controlar nuestro AlertDialog personalizado
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    isSuccess: false,
    confirmText: 'Aceptar'
  });

  const esModoExclusivo = (zona: CommonSpace | undefined): boolean => {
    if (!zona) return false;
    return zona?.usage_mode === "exclusive_reservation";
  }

  useEffect(() => {
    const fetchZonas = async () => {
      try {
        const data = await commonSpaceApi.listCommonSpaces(associationId);
        setZonas(data);
        
        if (data.length > 0) {
          setZonaActivaId(data[0].id); 
        }
      } catch (error) {
        console.error(error);
      }
    };

    if (associationId) {
      fetchZonas();
    }
  }, [associationId]);

  const fetchSlots = async () => {
    if (!zonaActivaId || !fechaSeleccionada) return;

    try {
      const baseSlots = GENERATE_BASE_SLOTS();
      const occupiedSlots = await bookingApi.listOccupiedSlots(zonaActivaId, fechaSeleccionada);
      
      const newSlots = baseSlots.map(time => {
        const isBooked = occupiedSlots.some(slot => {
          const slotStartDate = new Date(slot.start_at);
          const slotHourStr = `${slotStartDate.getHours().toString().padStart(2, '0')}:00`;
          return slotHourStr === time;
        });
        
        return { time, isBooked };
      });

      setSlotsDisponibles(newSlots);
    } catch (error) {
      console.error(error);
      setSlotsDisponibles(GENERATE_BASE_SLOTS().map(time => ({ time, isBooked: false })));
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [zonaActivaId, fechaSeleccionada]);

  const zonaActiva = zonas.find(z => z.id === zonaActivaId);

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
          guests_count: 0
        });

        await fetchSlots(); 
        
        // Mostrar alerta de éxito
        setAlertConfig({
          visible: true,
          title: "¡Reserva Confirmada!",
          message: "Tu reserva se ha creado correctamente.",
          isSuccess: true,
          confirmText: "Ver mis reservas"
        });
        
      } else {
        await guestPassApi.createGuestPass({
          space_id: zonaActivaId,
          valid_for_date: fechaSeleccionada
        });
        
        // Mostrar alerta de éxito
        setAlertConfig({
          visible: true,
          title: "¡Pase Generado!",
          message: "El pase de invitado se ha generado correctamente.",
          isSuccess: true,
          confirmText: "Ver mis pases"
        });
      }

    } catch (error) {
      console.error(error);
      // Mostrar alerta de error
      setAlertConfig({
        visible: true,
        title: "Error",
        message: "No se pudo completar la acción. Inténtalo de nuevo.",
        isSuccess: false,
        confirmText: "Aceptar"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función que se ejecuta al presionar el botón del AlertDialog
  const handleAlertConfirm = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    if (alertConfig.isSuccess) {
      router.push(`/${associationId}/mis-reservas`);
    }
  };

  const isSelectedSlotBooked = slotsDisponibles.find(s => s.time === horaSeleccionada)?.isBooked;

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pt-6 pb-28">
        
        <ReservasHeader isAdminOrPresident={isAdminOrPresident} isWorker={isWorker} associationId={associationId}/>

        <ZoneSelector 
          zonas={zonas} 
          zonaActivaId={zonaActivaId} 
          onSelectZona={setZonaActivaId} 
        />

        {isAdminOrPresident && zonaActiva && (
          <View className="flex-row justify-between items-center mb-4 px-1">
             <Text className="text-sm text-muted-foreground font-medium">Administración:</Text>
             <View className="flex-row gap-2">
               <Button variant="outline" size="sm" className="bg-blue-50/50 border-primary">
                  <Text className="text-primary font-bold text-xs">Editar</Text>
               </Button>
               <Button variant="destructive" size="sm">
                  <Text className="text-destructive-foreground font-bold text-xs">Eliminar</Text>
               </Button>
             </View>
          </View>
        )}

        {zonaActiva && (
          <View className="bg-card rounded-3xl p-3 mb-6 border border-border overflow-hidden">
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

        {Boolean(fechaSeleccionada) && esModoExclusivo(zonaActiva) && slotsDisponibles.length > 0 && (
          <TimeSlotsGrid 
            slots={slotsDisponibles} 
            horaSeleccionada={horaSeleccionada} 
            onSelectTime={setHoraSeleccionada} 
          />
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 p-5 bg-background/90 border-t border-border">
        <Button 
          className="bg-green-500 h-14 rounded-2xl" 
          onPress={handleReservar}
          disabled={isSubmitting || (esModoExclusivo(zonaActiva) && isSelectedSlotBooked) || !zonaActivaId}
        >
          <Text className="text-white text-lg font-bold">
            {isSubmitting 
              ? 'Procesando...' 
              : (!esModoExclusivo(zonaActiva) 
                  ? 'Generar Pase de Invitado' 
                  : `Reservar (${horaSeleccionada})`)}
          </Text>
        </Button>
      </View>

      {/* AlertDialog Reutilizable */}
      <AlertDialog 
        open={alertConfig.visible} 
        onOpenChange={(visible) => setAlertConfig(prev => ({ ...prev, visible }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertConfig.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={handleAlertConfirm}>
              <Text>{alertConfig.confirmText}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </View>
  );
}