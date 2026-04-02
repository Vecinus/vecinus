import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';

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

  const handleSave = async (data: any) => {
    if (!zona) return;

    const prev = zona;

    const optimistic = {
      ...zona,
      ...data,
    };

    setZona(optimistic);
    setErrorMessage('');

    try {
      const updated = await commonSpaceApi.updateCommonSpace(
        communityId as string,
        Number(zona_id),
        data
      );

      setZona(updated);
      router.push(`/${communityId}/booking`);
    } catch (error: any) {
      setZona(prev);
      const errorMsg =
        error?.response?.data?.detail ||
        error?.message ||
        'No se pudieron guardar los cambios. Intenta de nuevo.';
      setErrorMessage(errorMsg);
    }
  };

  if (loading || !zona) {
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
        initialData={zona}
        onSubmit={handleSave}
        onCancel={() => router.push(`/${communityId}/booking`)}
      />
    </ScrollView>
  );
}
