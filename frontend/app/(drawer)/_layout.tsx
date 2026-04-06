import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '@/components/custom-drawer-content';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HomeIcon, FileTextIcon, MoonStarIcon, SunIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { View } from 'react-native';

export default function DrawerLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const { activeCommunity } = useAuth();

  const THEME_ICONS = {
    light: SunIcon,
    dark: MoonStarIcon,
  };

  function ThemeToggle() {
    const { colorScheme, toggleColorScheme } = useColorScheme() as {
      colorScheme: 'light' | 'dark' | null | undefined;
      toggleColorScheme: () => void;
    };

    return (
      <Button
        onPressIn={toggleColorScheme}
        size="icon"
        variant="ghost"
        className="ios:size-9 rounded-full web:mx-4">
        <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-5" />
      </Button>
    );
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        drawerActiveTintColor: theme.colors.text,
        drawerInactiveTintColor: theme.colors.text,
        drawerStyle: {
          width: 300,
          backgroundColor: theme.colors.card,
        },
        drawerLabelStyle: {
          marginLeft: 0,
          fontWeight: '500',
        },
      }}>
      <Drawer.Screen
        name="index"
        options={{
          title: 'Inicio',
          drawerLabel: 'Inicio',
          headerRight: () => <ThemeToggle />,
          drawerIcon: ({ size, color }) => (
            <Icon as={HomeIcon} size={size} className="text-foreground" />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/actas"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Actas',
          drawerLabel: 'Actas',
          drawerIcon: ({ size, color }) => (
            <Icon as={FileTextIcon} size={size} className="text-foreground" />
          ),
        }}
      />
    </Drawer>
  );
}
