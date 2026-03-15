import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL } from '@/constants/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/store/useAuthStore';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const navigation = useNavigation();
  const { login } = useAuthStore();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#0F172A' }, 'background');
  const inputBorder = useThemeColor({ light: '#D1D5DB', dark: '#334155' }, 'text');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      setIsOpen(true);
      return () => {};
    }, [])
  );

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, introduce correo y contraseña');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Error al iniciar sesión');
      }

      const token = data.session?.access_token || data.access_token;
      
      if (token) {
        login(token);
        Alert.alert('Éxito', 'Sesión iniciada correctamente');
        setIsOpen(false);
        router.replace('/');
      } else {
        throw new Error('No se recibió el token de sesión');
      }

    } catch (error: unknown) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Ocurrió un error al intentar iniciar sesión';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor }]}>
      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => {
          setIsOpen(false);
          router.back();
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setIsOpen(false);
            router.back();
          }}
        >
          <Pressable style={[styles.card, { backgroundColor: cardBackground, paddingTop: insets.top + 12 }]}> 
            <View style={styles.cardHeader}>
              <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
                <Menu color={textColor} size={22} />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Iniciar Sesión</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setIsOpen(false);
                  router.back();
                }}
                hitSlop={10}
              >
                <ThemedText style={styles.closeText}>X</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Image
                source={require('../../../assets/logos/VecinusLogotipoTransparente.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <ThemedText style={styles.label}>Correo Electrónico</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: inputBorder }]}
                value={email}
                onChangeText={setEmail}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#888"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <ThemedText style={styles.label}>Contraseña</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: inputBorder }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Introduce tu contraseña"
                placeholderTextColor="#888"
                secureTextEntry
              />

              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Entrar</ThemedText>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setIsOpen(false);
                  router.back();
                }}
                disabled={loading}
              >
                <ThemedText style={styles.linkText}>Cancelar</ThemedText>
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
  label: {
    marginBottom: 6,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    fontSize: 14,
    height: 40,
  },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#0a7ea4',
    fontSize: 14,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
