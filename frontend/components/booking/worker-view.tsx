import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { CommonSpace } from '@/api/commonSpace';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WorkerViewProps {
  zonas: CommonSpace[];
  zonaActivaId: number | null;
  onSelectZona: (id: number) => void;
}

export function WorkerView({ zonas, zonaActivaId, onSelectZona }: WorkerViewProps) {
  const router = useRouter();
  
  const zonaActiva = zonas.find(z => z.id === zonaActivaId);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pt-16 pb-24">
        
        <View className="flex-1 justify-center items-center mt-10">
          <View className="bg-card p-8 rounded-3xl w-full border border-border shadow-sm">
            <Text className="text-2xl font-bold text-foreground mb-4 text-center">Validación de QR</Text>
            <Text className="text-base text-muted-foreground text-center mb-8 leading-6">
              Selecciona tu puesto de control actual y escanea los códigos QR para comprobar el acceso.
            </Text>

            <View className="mb-8 z-50">
              <Text className="text-sm text-muted-foreground font-medium mb-2">Punto de control actual:</Text>
              <Select
                value={zonaActiva ? { label: zonaActiva.name, value: zonaActiva.id.toString() } : undefined}
                onValueChange={(option) => option && onSelectZona(Number(option.value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la instalación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {zonas.map((zona) => (
                      <SelectItem key={zona.id} label={zona.name} value={zona.id.toString()}>
                        {zona.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </View>

            <Button 
              className="w-full h-14 rounded-2xl"
              // Pasamos el zoneId por parámetros para que el escáner sepa dónde estamos
              onPress={() => router.push({ pathname: './scanner', params: { zoneId: zonaActivaId } })}
              disabled={!zonaActivaId} // Deshabilitamos si no ha elegido zona
            >
              <Text className="text-primary-foreground text-lg font-bold">Abrir Escáner</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}