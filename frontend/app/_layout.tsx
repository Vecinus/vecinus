import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import SidebarMenu from '../components/SidebarMenu';
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
            name="comunities/[comunidad_id]/chatbot" 
            options={{ 
              headerShown: false
            }} 
          />

          {/* Cuando Kevin y Adrián terminen las suyas, añadirás aquí sus rutas, por ejemplo: */}
          {/* <Drawer.Screen name="actas/index" options={{ headerShown: false }} /> */}
          {/* <Drawer.Screen name="reservas/index" options={{ headerShown: false }} /> */}

        </Drawer>
        
        <StatusBar style="auto" />
      </ThemeProvider>
      
    </GestureHandlerRootView>
  );
}