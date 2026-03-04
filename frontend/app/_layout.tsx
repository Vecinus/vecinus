import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import SidebarMenu from '../components/SidebarMenu';
import { useCommunityStore } from '../store/useCommunityStore';
import { setGlobalJwtToken } from '../constants/api'; // Importamos la función

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const activeCommunityRole = useCommunityStore((state) => state.activeCommunityRole);
  const isAdmin = activeCommunityRole === 1 || activeCommunityRole === 4;

  // Estado para saber si el token ya ha sido obtenido
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const fetchInitialToken = async () => {
      try {
        const response = await fetch('https://asgmplswntnjkxtyebvb.supabase.co/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: {
            'apikey': 'sb_publishable_8HPnb90LqHqzrLUcgRizMw_ZZieerr4',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'prueba2@prueba.com',
            password: 'prueba2'
          })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
          // Guardamos el token en nuestra variable global
          setGlobalJwtToken(data.access_token);
          console.log('JWT obtenido y guardado con éxito');
        } else {
          console.error('Error obteniendo el JWT:', data);
        }
      } catch (error) {
        console.error('Error de red al obtener el JWT de Supabase:', error);
      } finally {
        // Indicamos que el proceso de autenticación finalizó
        setIsAuthReady(true);
      }
    };

    fetchInitialToken();
  }, []);

  // Si la autenticación aún no termina, mostramos un indicador de carga
  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Conectando...</Text>
      </View>
    );
  }

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