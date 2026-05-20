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

  const handleSave = async (data: Partial<CommonSpace>) => {
    setErrorMessage('');
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
        key="new"
        initialData={emptyZona}
        onSubmit={handleSave}
        onCancel={() => router.push(`/${communityId}/booking`)}
      />
    </ScrollView>
  );
}

