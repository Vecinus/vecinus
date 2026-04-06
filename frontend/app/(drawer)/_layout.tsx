import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '@/components/custom-drawer-content';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { Icon } from '@/components/ui/icon';
import {HomeIcon, FileTextIcon, MessageSquareIcon, Building2, MailIcon, CalendarCheck, } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/utils/community-role';

export default function DrawerLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const { activeCommunity, currentRole } = useAuth();
  const isAdmin = isAdminRole(currentRole);

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
      <Drawer.Screen
        name="[communityId]/chat"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Chat vecinos',
          drawerLabel: 'Chat vecinos',
          drawerIcon: ({ size }) => (
            <Icon as={MessageSquareIcon} size={size} className="text-foreground" />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/chatbot"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Chatbot',
          drawerLabel: 'Chatbot',
          drawerIcon: ({ size }) => (
            <Icon as={MessageSquareIcon} size={size} className="text-foreground" />
          ),
        }}
      />


      <Drawer.Screen
        name="[communityId]/booking"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Reservas',
          drawerLabel: 'Reservas',
          drawerIcon: ({ size, color }) => (
            <Icon
              as={CalendarCheck}
              size={size}
              className="text-foreground"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/mis-reservas"
        options={{
          title: 'Mis Reservas',
          drawerItemStyle: { display: 'none' }
        }}
      />
      <Drawer.Screen
        name="[communityId]/mis-reservas/[id]"
        options={{
          title: 'Detalle de Reserva/Pase',
          drawerItemStyle: { display: 'none' }
        }}
      />
      <Drawer.Screen
        name="[communityId]/scanner"
        options={{
          title: 'Escaner',
          drawerItemStyle: { display: 'none' }
        }}
      />
      <Drawer.Screen
        name="invitations"
        options={{
          title: 'Invitaciones',
          drawerLabel: 'Invitaciones',
          drawerIcon: ({ size, color }) => (
            <Icon
              as={MailIcon}
              size={size}
              className="text-foreground"
            />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/admin"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Comunidad',
          drawerLabel: 'Comunidad',
          drawerIcon: ({ size, color }) => (
            <Icon
              as={Building2}
              size={size}
              className="text-foreground"
            />
          ),
          drawerItemStyle: isAdmin ? undefined : { display: 'none' },
        }}
      />
    </Drawer>
  );
}
