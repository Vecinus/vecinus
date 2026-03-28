import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { LogOutIcon, UserIcon } from 'lucide-react-native';
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

  const handleLogout = async () => {
    await logoutContext();
    router.replace('/(auth)/sign-in');
  };

  const handleCommunityChange = (option: Option | null) => {
    if (!option) return;
    
    const selectedCommunity = user?.CommunitiesAndRole.find(
      (c) => c.community.id === option.value
    );

    if (selectedCommunity) {
      setActiveCommunity({
        id: selectedCommunity.community.id,
        name: selectedCommunity.community.name,
        role: selectedCommunity.role,
      });
      router.replace(`/`);
    }
  };

  const communityOptions: Option[] = user?.CommunitiesAndRole.map((c) => ({
    label: c.community.name,
    value: c.community.id,
  })) || [];

  const currentOption = activeCommunity ? {
    label: activeCommunity.name,
    value: activeCommunity.id,
  } : undefined;

  return (
    <View className="flex-1 bg-background">
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        <View className="p-6 border-b border-border mb-4">
          <View className="flex-row items-center gap-4 mb-6">
            <View className="size-14 rounded-full bg-muted items-center justify-center border border-border">
              <Icon as={UserIcon} size={28} className="text-muted-foreground" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-xl text-foreground" numberOfLines={1}>
                {user?.name || 'Usuario'}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {user?.email || 'usuario@ejemplo.com'}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase px-1">
              Comunidad Activa
            </Text>
            <Select
              value={currentOption}
              onValueChange={handleCommunityChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder="Selecciona una comunidad"
                  className="text-foreground text-sm"
                />
              </SelectTrigger>
              <SelectContent className="w-[250px]">
                <SelectGroup>
                  <SelectLabel>Tus Comunidades</SelectLabel>
                  {communityOptions.map((option) => (
                    <SelectItem
                      key={option!.value}
                      label={option!.label}
                      value={option!.value}
                    >
                      {option!.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </View>
        </View>

        <View className="px-2">
            <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      <View className="p-4 border-t border-border" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button 
          variant="destructive" 
          className="flex-row items-center justify-start gap-3 h-12 px-4 rounded-xl"
          onPress={handleLogout}
        >
          <Icon as={LogOutIcon} size={20} className="text-destructive-foreground" />
          <Text className="text-destructive-foreground font-semibold">Cerrar Sesión</Text>
        </Button>
      </View>
    </View>
  );
}
