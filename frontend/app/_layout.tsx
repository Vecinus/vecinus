import 'react-native-gesture-handler';
import '@/global.css';
import { useEffect } from 'react';
import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { setUnauthorizedHandler } from '@/lib/auth-events';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading, logoutContext } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  useEffect(() => {
    if (isLoading) return; // Espera a que termine el hydrate()

    const inAuthGroup = segments[0] === '(auth)';
    const isVoteRoute = (segments[0] as string) === 'votar';

    if (!isAuthenticated && !inAuthGroup && !isVoteRoute) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await logoutContext();
      router.replace('/(auth)/sign-in');
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logoutContext, router]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator color={theme.colors.primary} /> 
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <RootLayoutNav />
          <PortalHost /> 
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
