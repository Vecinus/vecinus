import { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { commonSpaceApi, CommonSpace } from '@/api/commonSpace';
import ZoneForm from '@/components/booking/zone-form';

export default function EditarZona() {
  const { communityId, zona_id } = useLocalSearchParams();
  const router = useRouter();

  const [zona, setZona] = useState<CommonSpace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const zonas = await commonSpaceApi.listCommonSpaces(communityId as string);
        const found = zonas.find((z) => String(z.id) === String(zona_id));
        if (!found) throw new Error();
        setZona(found);
      } catch {
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (data: any) => {
    if (!zona) return;

    const prev = zona;

    const optimistic = {
      ...zona,
      ...data,
    };

    setZona(optimistic);

    try {
      const updated = await commonSpaceApi.updateCommonSpace(
        communityId as string,
        Number(zona_id),
        data
      );

      setZona(updated);
      router.push(`/${communityId}/booking`);
    } catch {
      setZona(prev);
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
      <ZoneForm
        initialData={zona}
        onSubmit={handleSave}
        onCancel={() => router.push(`/${communityId}/booking`)}
      />
    </ScrollView>
  );
}
