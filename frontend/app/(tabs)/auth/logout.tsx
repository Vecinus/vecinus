import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL } from '@/constants/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/store/useAuthStore';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LogoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { logout, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#0F172A' }, 'background');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      setIsOpen(true);
      return () => {};
    }, [])
  );

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
      setIsOpen(false);
      router.replace('/'); 
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    router.back();
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}>
      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel}>
          <Pressable style={[styles.card, { backgroundColor: cardBackground, paddingTop: insets.top + 12 }]}> 
            <View style={styles.cardHeader}>
              <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
                <Menu color={textColor} size={22} />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Cerrar Sesión</ThemedText>
              <TouchableOpacity onPress={handleCancel} hitSlop={10}>
                <ThemedText style={styles.closeText}>X</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Image
                source={require('../../../assets/logos/VecinusLogotipoTransparente.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <ThemedText style={styles.message}>¿Estás seguro de que deseas cerrar sesión?</ThemedText>

              <TouchableOpacity 
                style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]} 
                onPress={handleLogout}
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
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  cardHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 54,
    alignSelf: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    marginBottom: 18,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
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
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#0a7ea4',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
