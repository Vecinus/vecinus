import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL } from '@/constants/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigation, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LogoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { logout, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Intentamos cerrar sesión en el backend
      const response = await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Logout endpoint returned error status:', response.status);
        // No lanzamos error para permitir que el logout local proceda
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Fallamos silenciosamente en el backend para no bloquear al usuario
    } finally {
      setLoading(false);
      localStorage.clear();
      // Siempre cerramos la sesión localmente
      logout();
       // Limpiamos cualquier dato almacenado localmente
      Alert.alert('Sesión Cerrada', 'Has cerrado sesión correctamente');
      router.replace('/'); 
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
          <Menu color={textColor} size={26} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Cerrar Sesión</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <ThemedText style={styles.message}>¿Estás seguro de que deseas cerrar sesión?</ThemedText>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]} 
            onPress={() => { void handleLogout(); }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Sí, cerrar sesión</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]} 
            onPress={handleCancel}
            disabled={loading}
          >
            <ThemedText style={[styles.buttonText, styles.cancelButtonText]}>Cancelar</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 26,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButton: {
    backgroundColor: '#ff4444',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#0a7ea4',
  },
});
