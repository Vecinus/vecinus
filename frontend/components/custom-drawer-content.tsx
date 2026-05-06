import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarCheck,
  FileTextIcon,
  HomeIcon,
  LogOutIcon,
  MailIcon,
  MessageSquareIcon,
  UserIcon,
  PlusCircle,
  Megaphone
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
import { useMemo } from 'react';
import { isAdminRole } from '@/utils/community-role';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, currentRole, logoutContext, activeCommunity, setActiveCommunity } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutContext();
    router.replace('/(auth)/sign-in');
  };

  const handleCommunityChange = async (option: Option | null) => {
    if (!option) return;

    if (String(option.value) === String(activeCommunity?.id)) return;

    const selectedCommunity = user?.CommunitiesAndRole.find(
      (c) => String(c.community.id) === String(option.value)
    );

    if (selectedCommunity) {
      await setActiveCommunity({
        id: selectedCommunity.community.id,
        name: selectedCommunity.community.name,
        role: selectedCommunity.role,
        address: selectedCommunity.community.address ?? null,
      });

      if (pathname !== '/') {
        router.replace('/');
      }
    }
  };

  const communityOptions: Option[] = useMemo(
    () =>
      user?.CommunitiesAndRole.map((c) => ({
        label: c.community.name,
        value: c.community.id,
      })) || [],
    [user?.CommunitiesAndRole]
  );

  const currentOption = useMemo(
    () =>
      activeCommunity
        ? {
          label: activeCommunity.name,
          value: activeCommunity.id,
        }
        : undefined,
    [activeCommunity]
  );

  const isAdmin = isAdminRole(currentRole);

  const navigateToCommunityRoute = (
    pathnameTemplate:
      | '/[communityId]/actas'
      | '/[communityId]/chat'
      | '/[communityId]/chatbot'
      | '/[communityId]/booking'
      | '/[communityId]/admin'
      | '/[communityId]/anuncios'
  ) => {
    if (!activeCommunity?.id) return;
    router.push({
      pathname: pathnameTemplate,
      params: { communityId: activeCommunity.id },
    });
  };

  const isHomeActive = pathname === '/';
  const isActasActive = pathname.endsWith('/actas') || pathname.includes('/actas/');
  const isChatActive = pathname.endsWith('/chat');
  const isChatbotActive = pathname.endsWith('/chatbot');
  const isBookingActive = pathname.endsWith('/booking') || pathname.includes('/mis-reservas');
  const isAdminActive = pathname.endsWith('/admin');
  const isInvitationsActive = pathname.includes('/invitations');
  const isAnnouncementsActive = pathname.endsWith('/anuncios') || pathname.includes('/anuncios/');

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
                  {communityOptions.map((option) => !option ? null : (
                    <SelectItem key={option.value} label={option.label} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </View>
        </View>

        <View className="px-2">
          <TouchableOpacity
            onPress={() => router.push('/')}
            className={`rounded-lg px-4 py-3 ${isHomeActive ? 'bg-muted' : 'active:bg-muted'}`}>
            <View className="flex-row items-center gap-3">
              <Icon as={HomeIcon} size={22} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Inicio</Text>
            </View>
          </TouchableOpacity>

          {activeCommunity ? (
            <>
              <TouchableOpacity
                onPress={() => navigateToCommunityRoute('/[communityId]/actas')}
                className={`rounded-lg px-4 py-3 ${isActasActive ? 'bg-muted' : 'active:bg-muted'}`}>
                <View className="flex-row items-center gap-3">
                  <Icon as={FileTextIcon} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Actas</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigateToCommunityRoute('/[communityId]/chat')}
                className={`rounded-lg px-4 py-3 ${isChatActive ? 'bg-muted' : 'active:bg-muted'}`}>
                <View className="flex-row items-center gap-3">
                  <Icon as={MessageSquareIcon} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Chat vecinos</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigateToCommunityRoute('/[communityId]/chatbot')}
                className={`rounded-lg px-4 py-3 ${isChatbotActive ? 'bg-muted' : 'active:bg-muted'}`}>
                <View className="flex-row items-center gap-3">
                  <Icon as={Bot} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Chatbot</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigateToCommunityRoute('/[communityId]/booking')}
                className={`rounded-lg px-4 py-3 ${isBookingActive ? 'bg-muted' : 'active:bg-muted'}`}>
                <View className="flex-row items-center gap-3">
                  <Icon as={CalendarCheck} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Reservas</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { navigateToCommunityRoute('/[communityId]/anuncios'); }}
                className={`rounded-lg px-4 py-3 ${isAnnouncementsActive ? 'bg-muted' : 'active:bg-muted'}`}
              >
                <View className="flex-row items-center gap-3">
                  <Icon as={Megaphone} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Anuncios</Text>
                </View>
              </TouchableOpacity>

              {isAdmin ? (
                <TouchableOpacity
                  onPress={() => navigateToCommunityRoute('/[communityId]/admin')}
                  className={`rounded-lg px-4 py-3 ${isAdminActive ? 'bg-muted' : 'active:bg-muted'}`}>
                  <View className="flex-row items-center gap-3">
                    <Icon as={Building2} size={22} className="text-muted-foreground" />
                    <Text className="font-medium text-foreground">Comunidad</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push('/(drawer)/invitations')}
            className={`rounded-lg px-4 py-3 ${isInvitationsActive ? 'bg-muted' : 'active:bg-muted'}`}>
            <View className="flex-row items-center gap-3">
              <Icon as={MailIcon} size={22} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Invitaciones</Text>
            </View>
          </TouchableOpacity>

          {activeCommunity ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/[communityId]/incidencias',
                  params: { communityId: activeCommunity.id },
                })
              }
              className="rounded-lg px-4 py-3 active:bg-muted">
              <View className="flex-row items-center gap-3">
                <Icon as={AlertTriangle} size={22} className="text-muted-foreground" />
                <Text className="font-medium text-foreground">Incidencias</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => router.push('/(drawer)/create-community')}
            className="rounded-lg px-4 py-3 active:bg-muted">
            <View className="flex-row items-center gap-3">
              <Icon as={PlusCircle} size={22} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Añadir Comunidad</Text>
            </View>
          </TouchableOpacity>
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
