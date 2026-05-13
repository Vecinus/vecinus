import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export default function GocardlessRenewCompleteScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-background p-8">
      <View className="w-full max-w-md items-center gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <View className="size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <Icon as={CheckCircle} size={32} className="text-emerald-600 dark:text-emerald-400" />
        </View>

        <View className="items-center gap-2">
          <Text className="text-center text-xl font-bold text-foreground">
            Cuenta bancaria actualizada
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            El nuevo mandato se ha configurado correctamente. Nuestro sistema está procesando el
            cambio y tu comunidad volverá a estar activa en unos instantes.
          </Text>
        </View>

        <Button onPress={() => router.replace('/')} className="h-12 w-full rounded-xl">
          <Text className="font-bold text-primary-foreground">Volver a la aplicación</Text>
        </Button>
      </View>
    </View>
  );
}
