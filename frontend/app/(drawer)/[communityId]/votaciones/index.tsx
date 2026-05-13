import { isAxiosError } from 'axios';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { pollService } from '@/api/services/poll.service';
import { PollReadResponse } from '@/types/poll.types';
import { PollListItem } from '@/components/votaciones/poll-list-item';
import { Scale, Plus } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { isAdminOrPresident } from '@/utils/role.util';
import { Drawer } from 'expo-router/drawer';
import { NAV_THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';

export default function Votaciones() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const [polls, setPolls] = React.useState<PollReadResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { currentRole } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const canCreate = isAdminOrPresident(currentRole);

  const fetchPolls = React.useCallback(async () => {
    if (!communityId) return;
    try {
      const data = await pollService.getPolls(communityId);
      setPolls(data);
    } catch (error: unknown) {
      if (!isAxiosError(error) || error.response?.status !== 402) {
        console.error('Error fetching polls:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [communityId]);

  useFocusEffect(
    React.useCallback(() => {
      fetchPolls();
    }, [fetchPolls])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPolls();
  };

  const handlePressPoll = (poll: PollReadResponse) => {
    router.push(`/${communityId}/votaciones/${poll.id}` as any);
  };

  const visiblePolls = React.useMemo(() => {
    if (canCreate) return polls;
    return polls.filter(
      (p) => p.current_status === 'ACTIVE' || p.current_status === 'FINISHED'
    );
  }, [polls, canCreate]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Drawer.Screen
        options={{
          title: 'Votaciones',
          headerRight: () =>
            canCreate ? (
              <TouchableOpacity
                onPress={() => router.push(`/${communityId}/votaciones/create` as any)}
                className="mr-4 rounded-full p-2 active:bg-muted">
                <Icon as={Plus} size={24} className="text-foreground" />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <FlatList
        data={visiblePolls}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PollListItem poll={item} onPress={() => handlePressPoll(item)} />
        )}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-20 h-20 rounded-full bg-muted items-center justify-center mb-4">
              <Icon as={Scale} size={40} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-lg font-semibold text-foreground">
              No hay votaciones disponibles
            </Text>
            <Text className="text-center text-muted-foreground mt-2 px-10">
              {canCreate
                ? 'Aún no se han registrado votaciones para esta comunidad.'
                : 'No hay votaciones activas o finalizadas en este momento.'}
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
