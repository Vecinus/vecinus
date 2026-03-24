import React, { useEffect } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "../global.css";

import {
  installAuthFetchInterceptor,
  registerSessionExpiredHandler,
  scheduleJwtAutoLogout,
} from "@/constants/api";
import { useColorScheme } from "@/hooks/use-color-scheme";
import SidebarMenu from "../components/SidebarMenu";
import { useAuthStore } from "../store/useAuthStore";
import { useCommunityStore } from "../store/useCommunityStore";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const validateSession = useAuthStore((state) => state.validateSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isRestoringSession = useAuthStore((state) => state.isRestoringSession);
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const pathname = usePathname();

  const activeCommunityRole = useCommunityStore(
    (state) => state.activeCommunityRole,
  );
  const isAdmin = activeCommunityRole === 1 || activeCommunityRole === 4;

  useEffect(() => {
    void validateSession();
  }, [validateSession]);

  useEffect(() => {
    installAuthFetchInterceptor();
    registerSessionExpiredHandler(() => {
      useAuthStore.getState().logout();
      router.replace("/auth/login");
    });
  }, [router]);

  useEffect(() => {
    scheduleJwtAutoLogout(token);
  }, [token]);

  useEffect(() => {
    if (isRestoringSession) {
      return;
    }

    const publicRoutes = new Set(["/", "/auth/login", "/auth/accept-invitation"]);

    if (!isAuthenticated && !publicRoutes.has(pathname)) {
      router.replace("/auth/login");
      return;
    }

    if (isAuthenticated && pathname === "/auth/login") {
      router.replace("/");
    }
  }, [isAuthenticated, isRestoringSession, pathname, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Drawer
          drawerContent={(props) => <SidebarMenu {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Drawer.Screen name="(tabs)" options={{ drawerLabel: "Inicio" }} />
          <Drawer.Screen
            name="modal"
            options={{ drawerItemStyle: { display: "none" } }}
          />

          <Drawer.Screen
            name="comunities/[comunidad_id]/chatbot"
            options={{ headerShown: false }}
          />

          <Drawer.Screen
            name="comunities/[comunidad_id]/actas"
            options={{ headerShown: false }}
          />

          <Drawer.Screen
            name="comunities/[comunidad_id]/admin"
            options={{
              headerShown: false,
              drawerItemStyle: isAdmin ? undefined : { display: "none" },
            }}
          />
        </Drawer>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
