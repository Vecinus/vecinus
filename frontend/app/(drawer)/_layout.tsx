import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '@/components/custom-drawer-content';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { Icon } from '@/components/ui/icon';
import { HomeIcon, FileTextIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

export default function DrawerLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const { activeCommunity } = useAuth();



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
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Inicio',
          drawerLabel: 'Inicio',
          drawerIcon: ({ size, color }) => (
            <Icon 
              as={HomeIcon} 
              size={size} 
              className="text-foreground" 
            />
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
            <Icon 
              as={FileTextIcon} 
              size={size} 
              className="text-foreground" 
            />
          ),
        }}
      />
    </Drawer>
  );
}