import { useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';

export default function CrearZona() {
  const { communityId } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const emptyZona: CommonSpace = {
    id: 0,
    association_id: communityId as string,
    name: '',
    start_time: '09:00',
    end_time: '21:00',
    requires_qr: false,
    max_capacity: 1,
    usage_mode: 'exclusive_reservation',
  };

  // --- Helpers de Validación ---
  const isValidTimeFormat = (time: string) => {
    // Valida formato estricto HH:MM (ej. 09:00, 23:59)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(time);
  };

  const timeToMinutes = (time: string) => {
    // Convierte HH:MM a minutos totales para comparar qué hora es mayor
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Función validadora principal
  const validateData = (data: any): string | null => {
    // 1. Validar Nombre
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
      return 'El nombre de la zona debe tener al menos 3 caracteres.';
    }
    if (data.name.length > 50) {
      return 'El nombre de la zona es demasiado largo (máximo 50 caracteres).';
    }

    // 2. Validar formato de horas
    if (!data.start_time || !isValidTimeFormat(data.start_time)) {
      return 'Formato de hora de inicio inválido (Usa HH:MM).';
    }
    if (!data.end_time || !isValidTimeFormat(data.end_time)) {
      return 'Formato de hora de fin inválido (Usa HH:MM).';
    }

    // 3. Lógica de horas (Fin debe ser posterior a Inicio)
    if (timeToMinutes(data.end_time) <= timeToMinutes(data.start_time)) {
      return 'La hora de fin debe ser posterior a la hora de inicio.';
    }

    // 4. Validar capacidad
    const maxCapacity = Number(data.max_capacity);
    if (isNaN(maxCapacity) || maxCapacity < 1 || !Number.isInteger(maxCapacity)) {
      return 'La capacidad máxima debe ser un número entero de al menos 1 persona.';
    }

    // 5. Validar invitados (Opcional, pero si existe debe ser lógico)
    if (
      data.max_guests_per_reservation !== undefined &&
      data.max_guests_per_reservation !== null &&
      data.max_guests_per_reservation !== ''
    ) {
      const guests = Number(data.max_guests_per_reservation);
      if (isNaN(guests) || guests < 0 || !Number.isInteger(guests)) {
        return 'El número de invitados debe ser un número entero positivo o cero.';
      }
      if (guests > maxCapacity) {
        return 'El máximo de invitados por reserva no puede superar la capacidad total de la zona.';
      }
    }

    // 6. Validar modo de uso
    if (data.usage_mode !== 'exclusive_reservation' && data.usage_mode !== 'shared_reservation') {
      return 'Modo de uso inválido.';
    }

    return null; // Si pasa todo, retorna null (sin error)
  };

  const handleSave = async (data: any) => {
    setErrorMessage('');

    // Ejecutamos la validación
    const validationError = validateData(data);

    // Si hay un error, lo mostramos y detenemos la ejecución
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);

    try {
      await commonSpaceApi.createCommonSpace(communityId as string, {
        name: data.name.trim(),
        start_time: data.start_time,
        end_time: data.end_time,
        requires_qr: !!data.requires_qr, // Forzamos booleano por seguridad
        max_capacity: Number(data.max_capacity),
        usage_mode: data.usage_mode,
        max_guests_per_reservation: data.max_guests_per_reservation !== undefined
          ? Number(data.max_guests_per_reservation)
          : undefined,
      });

      router.push(`/${communityId}/booking`);
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.detail ||
        error?.message ||
        'No se pudo crear la zona. Intenta de nuevo.';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background p-5">
      {errorMessage ? (
        <View className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3">
          <Text className="text-sm text-destructive">{errorMessage}</Text>
        </View>
      ) : null}
      <ZoneForm
        initialData={emptyZona}
        onSubmit={handleSave}
        onCancel={() => router.push(`/${communityId}/booking`)}
      />
    </ScrollView>
  );
}