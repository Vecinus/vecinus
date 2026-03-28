  import { Text } from '@/components/ui/text';
  import * as React from 'react';
  import { View, ScrollView } from 'react-native';
  import { useLocalSearchParams } from 'expo-router';
  import { useAuth } from '@/context/AuthContext';
                                                                                                                              
  export default function Actas() {
    const { communityId } = useLocalSearchParams<{ communityId: string }>();
    const { activeCommunity } = useAuth();

    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-background">
        <View className="flex-1 items-center justify-center gap-8 p-4 min-h-screen">
          <Text className="text-center text-3xl font-extrabold text-foreground">
            Actas de la comunidad
          </Text>
          <Text className="text-center text-lg text-muted-foreground">
            {activeCommunity?.name ? `Nombre: ${activeCommunity.name}` : null}
          </Text>
          <Text className="text-center text-md text-muted-foreground">
            ID de la comunidad: {communityId}
          </Text>
          <View className="p-6 bg-card rounded-xl border border-border w-full">
            <Text className="text-center text-muted-foreground">
              Aquí irá el listado de actas de la comunidad.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }