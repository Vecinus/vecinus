import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import SidebarMenu from '../components/SidebarMenu';
import { useCommunityStore } from '../store/useCommunityStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const activeCommunityRole = useCommunityStore((state) => state.activeCommunityRole);
  const isAdmin = activeCommunityRole === 1 || activeCommunityRole === 4;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Drawer 
          drawerContent={(props) => <SidebarMenu {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Inicio' }} />
          <Drawer.Screen name="modal" options={{ drawerItemStyle: { display: 'none' } }} />
          <Drawer.Screen
            name="comunities/[comunidad_id]/incidencias"
            options={{ headerShown: false }}
          />
          
          <Drawer.Screen 
            name="comunities/[comunidad_id]/chatbot" 
            options={{ headerShown: false }} 
          />
          
          {isAdmin ? (
            <Drawer.Screen 
              name="comunities/[comunidad_id]/admin" 
              options={{ headerShown: false }} 
            />
          ) : (
            <Drawer.Screen 
              name="comunities/[comunidad_id]/admin" 
              options={{ 
                headerShown: false,
                drawerItemStyle: { display: 'none' } 
              }} 
            />
          )}

        </Drawer>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}