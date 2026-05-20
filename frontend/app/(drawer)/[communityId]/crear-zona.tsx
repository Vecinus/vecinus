import { useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';
import { getErrorMessage } from '@/lib/error-message';

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
    capacity: 1,
    usage_mode: 'exclusive_reservation',
  };

  const isValidTimeFormat = (time: string) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(time);
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const validateData = (data: Partial<CommonSpace> & Record<string, unknown>): string | null => {
    const nameStr = String(data.name || '');
    if (!data.name || nameStr.trim().length < 3) {
      return 'El nombre de la zona debe tener al menos 3 caracteres.';
    }
    if (nameStr.length > 50) {
      return 'El nombre de la zona es demasiado largo (máximo 50 caracteres).';
    }

    let startTime = String(data.start_time || '').trim();
    let endTime = String(data.end_time || '').trim();
    if (!startTime && !endTime) {
      startTime = '00:00';
      endTime = '23:59';
    }
    if (!startTime || !endTime) {
      return 'Indica hora de apertura y cierre, o deja ambas vacias para disponibilidad 24h.';
    }

    if (!startTime || !isValidTimeFormat(startTime)) {
      return 'Formato de hora de inicio inválido (Usa HH:MM).';
    }
    if (!endTime || !isValidTimeFormat(endTime)) {
      return 'Formato de hora de fin inválido (Usa HH:MM).';
    }

    const endMinutes = timeToMinutes(endTime);
    const effectiveEndMinutes = endMinutes;

    if (effectiveEndMinutes <= timeToMinutes(startTime)) {
      return 'La hora de fin debe ser posterior a la hora de inicio.';
    }

    const maxCapacity = Number(data.capacity);
    if (!Number.isNaN(maxCapacity) && (!Number.isFinite(maxCapacity) || maxCapacity > 10000)) {
      return 'La capacidad maxima no puede superar las 10.000 personas.';
    }
    if (isNaN(maxCapacity) || maxCapacity < 1 || !Number.isInteger(maxCapacity)) {
      return 'La capacidad máxima debe ser un número entero de al menos 1 persona.';
    }
    if (maxCapacity > 10000) {
      return 'La capacidad máxima no puede superar las 10.000 personas.';
    }

    if (
      data.max_guests_per_reservation !== undefined &&
      data.max_guests_per_reservation !== null &&
      String(data.max_guests_per_reservation) !== ''
    ) {
      const guests = Number(data.max_guests_per_reservation);
      if (!Number.isNaN(guests) && (!Number.isFinite(guests) || guests > 10000)) {
        return 'El maximo de invitados por reserva no puede superar 10.000 personas.';
      }
      if (isNaN(guests) || guests < 0 || !Number.isInteger(guests)) {
        return 'El número de invitados debe ser un número entero positivo o cero.';
      }
      if (guests > maxCapacity) {
        return 'El máximo de invitados por reserva no puede superar la capacidad total de la zona.';
      }
    }

    if (data.usage_mode !== 'exclusive_reservation' && data.usage_mode !== 'guest_pass') {
      return 'Modo de uso inválido.';
    }
    if (typeof data.requires_qr !== 'boolean') {
      return 'Selecciona si la zona requiere invitacion QR.';
    }

    return null;
  };

  const handleSave = async (data: Partial<CommonSpace>) => {
    setErrorMessage('');

    const validationError = validateData(data);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);

    try {
      const startTime = String(data.start_time || '').trim();
      const endTime = String(data.end_time || '').trim();
      await commonSpaceApi.createCommonSpace(communityId as string, {
        name: data.name?.trim() || '',
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        requires_qr: data.requires_qr,
        capacity: Number(data.capacity),
        usage_mode: data.usage_mode as "exclusive_reservation" | "guest_pass",
        max_guests_per_reservation: data.max_guests_per_reservation !== undefined
          ? Number(data.max_guests_per_reservation)
          : undefined,
      });

      router.push(`/${communityId}/booking`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, 'No se pudo crear la zona. Intenta de nuevo.');
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

