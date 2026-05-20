import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';
import { getErrorMessage } from '@/lib/error-message';

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

  const capacity = Number(data.capacity);
  if (!Number.isNaN(capacity) && (!Number.isFinite(capacity) || capacity > 10000)) {
    return 'La capacidad maxima no puede superar las 10.000 personas.';
  }
  if (isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
    return 'La capacidad máxima debe ser un número entero de al menos 1 persona.';
  }
  if (capacity > 10000) {
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
    if (isNaN(guests) || guests < 1 || !Number.isInteger(guests)) {
      return 'El numero de invitados debe ser un entero de al menos 1.';
    }
    if (guests > capacity) {
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

export default function EditarZona() {
  const { communityId, zona_id } = useLocalSearchParams();
  const router = useRouter();

  const [zona, setZona] = useState<CommonSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const loadZona = useCallback(async () => {
    setLoading(true);
    try {
      const zonas = await commonSpaceApi.listCommonSpaces(communityId as string);
      const found = zonas.find((z) => String(z.id) === String(zona_id));
      if (!found) throw new Error();
      setZona(found);
      setErrorMessage('');
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }, [communityId, zona_id, router]);

  useEffect(() => {
    if (communityId && zona_id) {
      void loadZona();
    }
  }, [communityId, zona_id, loadZona]);

  useFocusEffect(
    useCallback(() => {
      if (communityId && zona_id) {
        loadZona();
      }
    }, [communityId, zona_id, loadZona])
  );

  const handleSave = async (data: Partial<CommonSpace>) => {
    if (!zona) return;

    setErrorMessage('');

    const validationError = validateData(data);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const prev = zona;
    const startTime = String(data.start_time || '').trim();
    const endTime = String(data.end_time || '').trim();

    const formattedData = {
      name: data.name?.trim() || '',
      requires_qr: !!data.requires_qr,
      capacity: Number(data.capacity),
      usage_mode: data.usage_mode as "exclusive_reservation" | "guest_pass" | undefined,
      start_time: startTime || null,
      end_time: endTime || null,
      max_guests_per_reservation:
        data.max_guests_per_reservation !== undefined && String(data.max_guests_per_reservation) !== ''
          ? Number(data.max_guests_per_reservation)
          : undefined,
    };

    const optimistic = {
      ...zona,
      ...formattedData,
    };

    setZona(optimistic as CommonSpace);

    try {
      const updated = await commonSpaceApi.updateCommonSpace(
        communityId as string,
        Number(zona_id),
        formattedData
      );

      setZona(updated);
      router.push(`/${communityId}/booking`);
    } catch (error: unknown) {
      setZona(prev);
      const errorMsg = getErrorMessage(error, 'No se pudieron guardar los cambios. Intenta de nuevo.');
      setErrorMessage(errorMsg);
    }
  };

  if (loading || !zona) {
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
        initialData={zona}
        onSubmit={handleSave}
        onCancel={() => router.push(`/${communityId}/booking`)}
      />
    </ScrollView>
  );
}

