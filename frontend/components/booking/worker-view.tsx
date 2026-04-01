import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ReservasHeader } from './booking-header';

export function WorkerView() {
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pt-16 pb-24">
        <ReservasHeader title="Accesos" isAdminOrPresident={false} isWorker={true} />
        
        <View className="flex-1 justify-center items-center mt-10">
          <View className="bg-card p-8 rounded-3xl w-full items-center border border-border shadow-sm">
            <Text className="text-2xl font-bold text-foreground mb-4">Validación de QR</Text>
            <Text className="text-base text-muted-foreground text-center mb-8 leading-6">
              Escanea los códigos QR de los vecinos o invitados para comprobar si tienen una reserva o pase válido para acceder a las instalaciones.
            </Text>
            <Button className="w-full h-14 rounded-2xl">
              <Text className="text-primary-foreground text-lg font-bold">Abrir Escáner</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}