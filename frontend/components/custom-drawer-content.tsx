import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  FileTextIcon,
  HomeIcon,
  LogOutIcon,
  MessageSquareIcon,
  UserIcon,
} from 'lucide-react-native';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type Option,
} from '@/components/ui/select';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logoutContext, activeCommunity, setActiveCommunity } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutContext();
    router.replace('/(auth)/sign-in');
  };

  const handleCommunityChange = (option: Option | null) => {
    if (!option) return;

    const selectedCommunity = user?.CommunitiesAndRole.find((c) => c.community.id === option.value);

    if (selectedCommunity) {
      setActiveCommunity({
        id: selectedCommunity.community.id,
        name: selectedCommunity.community.name,
        role: selectedCommunity.role,
        address: selectedCommunity.community.address ?? null,
      });
      if (pathname.endsWith('/actas')) {
        router.replace(`/${selectedCommunity.community.id}/actas`);
        return;
      }

      if (pathname.endsWith('/chatbot')) {
        router.replace(`/${selectedCommunity.community.id}/chatbot`);
        return;
      }

      if (pathname.endsWith('/chat')) {
        router.replace(`/${selectedCommunity.community.id}/chat`);
        return;
      }

      router.replace('/');

    }
  };

  const communityOptions: Option[] =
    user?.CommunitiesAndRole.map((c) => ({
      label: c.community.name,
      value: c.community.id,
    })) || [];

  const currentOption = activeCommunity
    ? {
        label: activeCommunity.name,
        value: activeCommunity.id,
      }
    : undefined;

  const isHomeActive = pathname === '/';
  const isActasActive = pathname.endsWith('/actas');
  const isChatActive = pathname.endsWith('/chat');
  const isChatbotActive = pathname.endsWith('/chatbot');

  return (
    <View className="flex-1 bg-background">
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: insets.top }}>
        <View className="mb-4 border-b border-border p-6">
          <View className="mb-6 flex-row items-center gap-4">
            <View className="size-14 items-center justify-center rounded-full border border-border bg-muted">
              <Icon as={UserIcon} size={28} className="text-muted-foreground" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
                {user?.name || 'Usuario'}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {user?.email || 'usuario@ejemplo.com'}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="px-1 text-xs font-semibold uppercase text-muted-foreground">
              Comunidad Activa
            </Text>
            <Select value={currentOption} onValueChange={handleCommunityChange}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder="Selecciona una comunidad"
                  className="text-sm text-foreground"
                />
              </SelectTrigger>
              <SelectContent className="w-[250px]">
                <SelectGroup>
                  <SelectLabel>Tus Comunidades</SelectLabel>
                  {communityOptions.map((option) => (
                    <SelectItem key={option!.value} label={option!.label} value={option!.value}>
                      {option!.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </View>
        </View>

        <View className="gap-1 px-2">
          <DrawerItem
            label="Inicio"
            focused={isHomeActive}
            onPress={() => {
              router.replace('/');
            }}
            icon={({ size }) => <Icon as={HomeIcon} size={size} className="text-foreground" />}
            labelStyle={{
              marginLeft: 0,
              fontWeight: '500',
              color:
                props.descriptors[props.state.routes[0]?.key ?? '']?.options.drawerActiveTintColor,
            }}
          />

          <DrawerItem
            label="Actas"
            focused={isActasActive}
            onPress={() => {
              if (!activeCommunity?.id) return;
              router.replace(`/${activeCommunity.id}/actas`);
            }}
            icon={({ size }) => <Icon as={FileTextIcon} size={size} className="text-foreground" />}
            labelStyle={{ marginLeft: 0, fontWeight: '500' }}
          />

          <DrawerItem
            label="Chat vecinos"
            focused={isChatActive}
            onPress={() => {
              if (!activeCommunity?.id) return;
              router.replace(`/${activeCommunity.id}/chat`);
            }}
            icon={({ size }) => (
              <Icon as={MessageSquareIcon} size={size} className="text-foreground" />
            )}
            labelStyle={{ marginLeft: 0, fontWeight: '500' }}
          />

          <DrawerItem
            label="Chatbot"
            focused={isChatbotActive}
            onPress={() => {
              if (!activeCommunity?.id) return;
              router.replace(`/${activeCommunity.id}/chatbot`);
            }}
            icon={({ size }) => (
              <Icon as={MessageSquareIcon} size={size} className="text-foreground" />
            )}
            labelStyle={{ marginLeft: 0, fontWeight: '500' }}
          />
        </View>
      </DrawerContentScrollView>

      <View className="border-t border-border p-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button
          variant="destructive"
          className="h-12 flex-row items-center justify-start gap-3 rounded-xl px-4"
          onPress={handleLogout}>
          <Icon as={LogOutIcon} size={20} className="text-destructive-foreground" />
          <Text className="font-semibold text-destructive-foreground">Cerrar Sesión</Text>
        </Button>
      </View>
    </View>
  );
}
