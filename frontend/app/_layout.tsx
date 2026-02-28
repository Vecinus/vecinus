import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Tus hooks y componentes
import { useColorScheme } from '@/hooks/use-color-scheme';
import SidebarMenu from '../components/SidebarMenu'; // El diseño de tu menú

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // 1. GestureHandler envuelve todo para detectar tu dedo al deslizar
    <GestureHandlerRootView style={{ flex: 1 }}>
      
      {/* 2. Mantenemos el ThemeProvider para el Modo Oscuro/Claro */}
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        
        {/* 3. Cambiamos el <Stack> por tu <Drawer> */}
        <Drawer 
          drawerContent={(props) => <SidebarMenu {...props} />}
          screenOptions={{ headerShown: false }} // Oculta la cabecera fea por defecto
        >
          
          {/* Mantenemos tus rutas originales */}
          <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Inicio' }} />
          
          {/* Mantenemos el modal, pero lo ocultamos visualmente del menú lateral para que no salga un botón raro */}
          <Drawer.Screen name="modal" options={{ drawerItemStyle: { display: 'none' } }} />

          {/* 4. Aquí irán las pantallas de tus compañeros cuando las programen */}
          
          <Drawer.Screen 
            name="comunities/[comunidad_id]/chatbot" 
            options={{ 
              headerShown: false // Aseguramos que no salga la barra blanca fea de Expo
            }} 
          />

          {/* Cuando Kevin y Adrián terminen las suyas, añadirás aquí sus rutas, por ejemplo: */}
          {/* <Drawer.Screen name="actas/index" options={{ headerShown: false }} /> */}
          {/* <Drawer.Screen name="reservas/index" options={{ headerShown: false }} /> */}

        </Drawer>
        
        {/* 5. Mantenemos la barra de estado original */}
        <StatusBar style="auto" />
      </ThemeProvider>
      
    </GestureHandlerRootView>
  );
}