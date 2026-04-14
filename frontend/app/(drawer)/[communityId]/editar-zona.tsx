import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';

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

  const startTime = data.start_time as string;
  const endTime = data.end_time as string;

  if (!startTime || !isValidTimeFormat(startTime)) {
    return 'Formato de hora de inicio inválido (Usa HH:MM).';
  }
  if (!endTime || !isValidTimeFormat(endTime)) {
    return 'Formato de hora de fin inválido (Usa HH:MM).';
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return 'La hora de fin debe ser posterior a la hora de inicio.';
  }

  const capacity = Number(data.capacity);
  if (isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
    return 'La capacidad máxima debe ser un número entero de al menos 1 persona.';
  }

  if (
    data.max_guests_per_reservation !== undefined &&
    data.max_guests_per_reservation !== null &&
    String(data.max_guests_per_reservation) !== ''
  ) {
    const guests = Number(data.max_guests_per_reservation);
    if (isNaN(guests) || guests < 0 || !Number.isInteger(guests)) {
      return 'El número de invitados debe ser un número entero positivo o cero.';
    }
    if (guests > capacity) {
      return 'El máximo de invitados por reserva no puede superar la capacidad total de la zona.';
    }
  }

  if (data.usage_mode !== 'exclusive_reservation' && data.usage_mode !== 'guest_pass') {
    return 'Modo de uso inválido.';
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
      loadZona();
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

    const formattedData = {
      ...data,
      name: data.name?.trim() || '',
      requires_qr: !!data.requires_qr,
      capacity: Number(data.capacity),
      usage_mode: data.usage_mode as "exclusive_reservation" | "guest_pass" | undefined,
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
      const err = error as { response?: { data?: { detail?: string } }; message?: string };

      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        'No se pudieron guardar los cambios. Intenta de nuevo.';

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