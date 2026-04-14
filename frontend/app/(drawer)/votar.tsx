import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';

export default function VoterPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const token = params?.token as string;
  const poll_id = params?.poll_id as string;
  const association_id = params?.association_id as string;

  useEffect(() => {
    if (poll_id && association_id && token) {
      router.replace(`/${association_id}/polls/${poll_id}?token=${token}` as any);
    } else {
      router.replace('/');
    }
  }, [poll_id, association_id, token, router]);

  return (
    <ScrollView className="flex-1 items-center justify-center bg-background">
      <View>
        <Text className="text-lg font-semibold text-foreground">Redirigiendo a votación...</Text>
      </View>
    </ScrollView>
  );
}
