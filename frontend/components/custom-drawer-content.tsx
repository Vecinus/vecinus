import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { Image } from 'expo-image';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ShieldAlert,
  UserIcon,
  PlusCircle,
  Scale,
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
import { updateMyAvatarUrl } from '@/api/auth';
import { useEffect, useMemo, useState } from 'react';
import { isAdminRole } from '@/utils/community-role';

function looksLikeDirectImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const {
    user,
    token,
    currentRole,
    logoutContext,
    activeCommunity,
    setActiveCommunity,
    refreshUserContext,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [pendingAvatarValidationUrl, setPendingAvatarValidationUrl] = useState<string | null>(null);

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

  useEffect(() => {
    setAvatarUrlInput(user?.avatarUrl ?? '');
  }, [user?.avatarUrl]);

  const navigateToCommunityRoute = (
    pathnameTemplate:
      | '/[communityId]/actas'
      | '/[communityId]/votaciones'
      | '/[communityId]/chat'
      | '/[communityId]/chatbot'
      | '/[communityId]/booking'
      | '/[communityId]/admin'
  ) => {
    if (!activeCommunity?.id) return;
    router.push({
      pathname: pathnameTemplate,
      params: { communityId: activeCommunity.id },
    });
  };

  const isHomeActive = pathname === '/';
  const isActasActive = pathname.endsWith('/actas') || pathname.includes('/actas/');
  const isVotacionesActive = pathname.endsWith('/votaciones') || pathname.includes('/votaciones/');
  const isChatActive = pathname.endsWith('/chat');
  const isChatbotActive = pathname.endsWith('/chatbot');
  const isBookingActive = pathname.endsWith('/booking') || pathname.includes('/mis-reservas');
  const isAdminActive = pathname.endsWith('/admin');
  const isInvitationsActive = pathname.includes('/invitations');
  const isAccountActive = pathname.includes('/account');

  const handleAvatarDialogChange = (open: boolean) => {
    setAvatarDialogOpen(open);
    if (open) {
      setAvatarUrlInput(user?.avatarUrl ?? '');
      setAvatarError('');
    }
  };

  const persistAvatar = async (avatarUrl: string | null) => {
    try {
      await updateMyAvatarUrl(token!, avatarUrl);
      await refreshUserContext();
      setAvatarDialogOpen(false);
    } catch (error: any) {
      setAvatarError(
        error?.response?.data?.detail || 'No se pudo actualizar la imagen de perfil.'
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!token) {
      setAvatarError('Tu sesión no es válida. Vuelve a iniciar sesión.');
      return;
    }

    const normalizedAvatarUrl = avatarUrlInput.trim();
    if (
      normalizedAvatarUrl &&
      !(
        normalizedAvatarUrl.startsWith('http://') ||
        normalizedAvatarUrl.startsWith('https://')
      )
    ) {
      setAvatarError('La URL debe comenzar por http:// o https://');
      return;
    }

    if (normalizedAvatarUrl && !looksLikeDirectImageUrl(normalizedAvatarUrl)) {
      setAvatarError('Imagen no válida');
      return;
    }

    setAvatarError('');
    setIsSavingAvatar(true);

    if (!normalizedAvatarUrl) {
      await persistAvatar(null);
      return;
    }

    setPendingAvatarValidationUrl(normalizedAvatarUrl);
  };

  return (
    <View className="flex-1 bg-background">
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: insets.top }}>
        <View className="mb-4 border-b border-border p-6">
          <View className="mb-6 flex-row items-center gap-4">
            <TouchableOpacity onPress={() => handleAvatarDialogChange(true)} activeOpacity={0.8}>
              <Avatar alt={user?.name || 'Usuario'} className="size-14 border border-border bg-muted">
                {user?.avatarUrl ? <AvatarImage source={{ uri: user.avatarUrl }} /> : null}
                <AvatarFallback className="bg-muted">
                  <Icon as={UserIcon} size={28} className="text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </TouchableOpacity>
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
                  {communityOptions.map((option) =>
                    !option ? null : (
                      <SelectItem key={option.value} label={option.label} value={option.value}>
                        {option.label}
                      </SelectItem>
                    )
                  )}
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
                onPress={() => navigateToCommunityRoute('/[communityId]/votaciones')}
                className={`rounded-lg px-4 py-3 ${isVotacionesActive ? 'bg-muted' : 'active:bg-muted'}`}>
                <View className="flex-row items-center gap-3">
                  <Icon as={Scale} size={22} className="text-muted-foreground" />
                  <Text className="font-medium text-foreground">Votaciones</Text>
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
          <TouchableOpacity
            onPress={() => router.push('/(drawer)/account')}
            className={`rounded-lg px-4 py-3 ${isAccountActive ? 'bg-muted' : 'active:bg-muted'}`}>
            <View className="flex-row items-center gap-3">
              <Icon as={ShieldAlert} size={22} className="text-muted-foreground" />
              <Text className="font-medium text-foreground">Cuenta</Text>
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

      <Dialog open={avatarDialogOpen} onOpenChange={handleAvatarDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar imagen de perfil</DialogTitle>
            <DialogDescription>
              Pega una URL directa de imagen. Si lo dejas vacío, se quitará el avatar actual.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-3">
            <Input
              value={avatarUrlInput}
              onChangeText={(value) => {
                setAvatarUrlInput(value);
                if (avatarError === 'Imagen no válida') {
                  setAvatarError('');
                }
              }}
              placeholder="https://ejemplo.com/avatar.jpg"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isSavingAvatar}
            />
            {avatarError ? (
              <Text className="text-sm font-medium text-destructive">{avatarError}</Text>
            ) : null}
          </View>

          <DialogFooter>
            <Button
              variant="outline"
              onPress={() => handleAvatarDialogChange(false)}
              disabled={isSavingAvatar}>
              <Text>Cancelar</Text>
            </Button>
            <Button onPress={handleSaveAvatar} disabled={isSavingAvatar}>
              <Text>{isSavingAvatar ? 'Guardando...' : 'Guardar'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingAvatarValidationUrl ? (
        <Image
          source={{ uri: pendingAvatarValidationUrl }}
          style={{ width: 1, height: 1, opacity: 0 }}
          onLoad={() => {
            const validatedAvatarUrl = pendingAvatarValidationUrl;
            setPendingAvatarValidationUrl(null);
            void persistAvatar(validatedAvatarUrl);
          }}
          onError={() => {
            setPendingAvatarValidationUrl(null);
            setIsSavingAvatar(false);
            setAvatarError('Imagen no válida');
          }}
        />
      ) : null}
    </View>
  );
}
