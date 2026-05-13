import { Text } from '@/components/ui/text';
import * as React from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { minutesService } from '@/api/services/minutes.service';
import { storageService } from '@/api/services/storage.service';
import { MinutesReadResponse } from '@/types/minutes.types';
import { ActaListItem } from '@/components/actas/acta-list-item';
import { FileText, Plus } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { isAdminOrPresident } from '@/utils/role.util';
import { CreateActaCard } from '@/components/actas/create-acta-card';
import { Drawer } from 'expo-router/drawer';

export default function Actas() {
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{ communityId?: string | string[] }>();
  const [minutes, setMinutes] = React.useState<MinutesReadResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { activeCommunity, currentRole, isLoading: isAuthLoading, token } = useAuth();
  const router = useRouter();
  const routeCommunityId = Array.isArray(routeCommunityIdRaw) ? routeCommunityIdRaw[0] : routeCommunityIdRaw;
  const communityId = routeCommunityId || activeCommunity?.id || '';

  const canCreate = isAdminOrPresident(currentRole);

  const fetchMinutes = React.useCallback(async () => {
    if (isAuthLoading) return;

    if (!communityId) {
      setErrorMessage('Selecciona una comunidad para ver sus actas.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!token) {
      setErrorMessage('Tu sesion ha caducado. Vuelve a iniciar sesion.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setErrorMessage(null);
      const data = await minutesService.getMinutes(communityId, token);
      setMinutes(data);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { detail?: unknown } } };
      const status = axiosError?.response?.status;
      const detail = axiosError?.response?.data?.detail;
      setErrorMessage(
        status === 401
          ? 'Tu sesion ha caducado. Vuelve a iniciar sesion.'
          : typeof detail === 'string'
            ? detail
            : 'No se pudieron cargar las actas.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [communityId, isAuthLoading, token]);

  React.useEffect(() => {
    fetchMinutes();
  }, [fetchMinutes]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchMinutes();
  };

  const handlePressActa = async (acta: MinutesReadResponse) => {
    await storageService.saveSelectedMinute(acta);
    router.push(`/${communityId}/actas/${acta.id}`);
  };

  const handleCreateSuccess = () => {
    setIsCreating(false);
    fetchMinutes();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          headerRight: () => canCreate ? (
            <TouchableOpacity 
              onPress={() => setIsCreating(true)}
              className="mr-4 rounded-full p-2 active:bg-muted"
            >
              <Icon as={Plus} size={24} className="text-foreground" />
            </TouchableOpacity>
          ) : null,
        }}
      />

      <CreateActaCard 
        communityId={communityId} 
        onSuccess={handleCreateSuccess}
        open={isCreating}
        onOpenChange={setIsCreating}
      />

      <FlatList
        data={minutes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActaListItem acta={item} onPress={() => handlePressActa(item)} />
        )}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20">
             <View className="w-20 h-20 rounded-full bg-muted items-center justify-center mb-4">
                <Icon as={FileText} size={40} className="text-muted-foreground" />
             </View>
            <Text className="text-center text-lg font-semibold text-foreground">
              {errorMessage ? 'No se pudieron cargar las actas' : 'No hay actas disponibles'}
            </Text>
            <Text className="text-center text-muted-foreground mt-2 px-10">
              Aún no se han registrado actas para esta comunidad.
            </Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}
