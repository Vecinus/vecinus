import React, { useEffect } from 'react';
import { View , Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { useNavigation } from 'expo-router';

interface ReservasHeaderProps {
  title?: string;
  isAdminOrPresident: boolean;
  isWorker: boolean;
}

export function ReservasHeader({ title = "Reservas", isAdminOrPresident, isWorker }: ReservasHeaderProps) {
    const navigation = useNavigation();
    useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
      <View className="flex-row gap-2">
        {isAdminOrPresident && (
          <Button variant="outline" size="sm" className="rounded-full border-primary">
            <Text className="text-primary font-bold">+ Zona</Text>
          </Button>
        )}
        {!isWorker && (
          <Button variant="outline" size="sm" className="rounded-full border-primary">
            <Text className="text-primary font-bold">Mis Pases/Reservas</Text>
          </Button>
        )}
      </View>
      ),
    });
  }, [navigation]);

  return (
    <></>
  );

}