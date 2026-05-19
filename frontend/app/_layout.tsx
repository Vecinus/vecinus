import 'react-native-gesture-handler';
import '@/global.css';
import { useCallback, useEffect, useState } from 'react';
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
import { setCommunityBlockedHandler } from '@/lib/payment-events';
import { CommunityBlockedModal } from '@/components/community-blocked-modal';
import type { CommunityBlockedDetail } from '@/types/payments.types';
import { isAxiosError } from 'axios';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const DEFAULT_QUERY_RETRIES = 3;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response?.status === 402) {
          return false;
        }
        return failureCount < DEFAULT_QUERY_RETRIES;
      },
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading, logoutContext } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? 'light'];

  const [blockedDetail, setBlockedDetail] = useState<CommunityBlockedDetail | null>(null);

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

  useEffect(() => {
    setCommunityBlockedHandler((detail) => {
      setBlockedDetail((current) => current ?? detail);


      router.replace('/');
    });

    return () => {
      setCommunityBlockedHandler(null);
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated && blockedDetail) {
      setBlockedDetail(null);
    }
  }, [isAuthenticated, blockedDetail]);

  const handleCloseBlocked = useCallback(() => setBlockedDetail(null), []);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <CommunityBlockedModal detail={blockedDetail} onClose={handleCloseBlocked} />
    </>
  );
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
