import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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

  const handleSave = async (data: any) => {
    setLoading(true);
    setErrorMessage('');

    try {
      await commonSpaceApi.createCommonSpace(communityId as string, {
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        requires_qr: data.requires_qr,
        max_capacity: data.max_capacity,
        usage_mode: data.usage_mode,
        max_guests_per_reservation: data.max_guests_per_reservation,
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
        <ActivityIndicator />
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
