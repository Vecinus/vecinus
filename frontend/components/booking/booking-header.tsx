import React, { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { CalendarCheck, Plus } from 'lucide-react-native';

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
        <View className="mr-2 flex-row items-center gap-1">
          {isAdminOrPresident && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => router.push(`/${associationId}/crear-zona`)}
              className="h-10 w-10 items-center justify-center rounded-full border border-primary bg-blue-50/50 active:bg-blue-100">
              <Icon as={Plus} size={20} className="text-primary" />
            </TouchableOpacity>
          )}
          {!isWorker && (
            <TouchableOpacity
              hitSlop={8}
              accessibilityLabel="Mis Pases y Reservas"
              onPress={() => router.push(`/${associationId}/mis-reservas`)}
              className="h-10 w-10 items-center justify-center rounded-full border border-primary bg-blue-50/50 active:bg-blue-100">
              <Icon as={CalendarCheck} size={18} className="text-primary" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [associationId, isAdminOrPresident, isWorker, navigation, router]);

  return <></>;
}
