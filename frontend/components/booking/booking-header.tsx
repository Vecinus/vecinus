import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { useNavigation, useRouter } from 'expo-router';

interface ReservasHeaderProps {
  title?: string;
  isAdminOrPresident: boolean;
  isWorker: boolean;
  associationId: string;
}

export function ReservasHeader({
  title = 'Reservas',
  isAdminOrPresident,
  isWorker,
  associationId,
}: ReservasHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row gap-2">
          {isAdminOrPresident && (
            <Button
              variant="outline"
              size="sm"
              className="mb-4 border-primary bg-green-50/50"
              onPress={() => router.push(`/${associationId}/crear-zona`)}>
              <Text className="font-bold text-primary">+ Zona</Text>
            </Button>
          )}
          {!isWorker && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-primary"
              onPress={() => router.push(`/${associationId}/mis-reservas`)}>
              <Text className="font-bold text-primary">Mis Pases/Reservas</Text>
            </Button>
          )}
        </View>
      ),
    });
  }, [navigation]);

  return <></>;
}
