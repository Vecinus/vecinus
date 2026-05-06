import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '@/components/custom-drawer-content';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  HomeIcon,
  FileTextIcon,
  MoonStarIcon,
  SunIcon,
  MessageSquareIcon,
  Bot,
  Building2,
  MailIcon,
  AlertTriangle, CalendarCheck, Megaphone
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/utils/community-role';

export default function DrawerLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];
  const { activeCommunity, currentRole } = useAuth();

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
          headerRight: () => <ThemeToggle />,
          drawerIcon: ({ size, color }) => (
            <Icon as={HomeIcon} size={size} className="text-foreground" />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/actas/index"
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
            <Icon as={Bot} size={size} className="text-foreground" />
          ),
        }}
      />

      <Drawer.Screen
        name="[communityId]/incidencias"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Incidencias',
          drawerLabel: 'Incidencias',
          drawerIcon: ({ size, color }) => (
            <Icon
              as={AlertTriangle}
              size={size}
              className="text-foreground"
            />
          ),
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/anuncios"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Anuncios',
          drawerLabel: 'Anuncios',
          drawerIcon: ({ size }) => (
            <Icon as={Megaphone} size={size} className="text-foreground" />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/anuncio/[id]"
        options={{
          title: 'Detalle de Anuncio',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/actas/[actaId]"
        options={{
          title: 'Detalle de Acta',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/booking"
        initialParams={{ communityId: activeCommunity?.id }}
        options={{
          title: 'Reservas',
          drawerLabel: 'Reservas',
          drawerIcon: ({ size, color }) => (
            <Icon as={CalendarCheck} size={size} className="text-foreground" />
          ),
        }}
      />
      <Drawer.Screen
        name="[communityId]/mis-reservas"
        options={{
          title: 'Mis Reservas',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/mis-reservas/[id]"
        options={{
          title: 'Detalle de Reserva/Pase',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/scanner"
        options={{
          title: 'Escaner',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="invitations"
        options={{
          title: 'Invitaciones',
          drawerLabel: 'Invitaciones',
          drawerIcon: ({ size, color }) => (
            <Icon as={MailIcon} size={size} className="text-foreground" />
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
            <Icon as={Building2} size={size} className="text-foreground" />
          ),
          drawerItemStyle: isAdmin ? undefined : { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/incidencia/[incidentId]"
        options={{
          headerTitle: 'Detalle de Incidencia',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/crear-zona"
        options={{
          title: 'Crear Instalación',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="[communityId]/editar-zona"
        options={{
          title: 'Editar Instalación',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="create-community"
        options={{
          title: 'Crear Comunidad',
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="legal"
        options={{
          title: 'Documentación legal',
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}
