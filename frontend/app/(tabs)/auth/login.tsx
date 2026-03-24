import { DrawerActions } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import { useNavigation, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_URL } from '@/constants/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/store/useAuthStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const { login } = useAuthStore();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const insets = useSafeAreaInsets();
  const passwordInputRef = React.useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, introduce correo y contrasena');
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

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || 'Error inesperado del servidor');
      }

      if (!response.ok) {
        throw new Error(data?.detail || 'Error al iniciar sesión. Comprueba tus credenciales.');
      }

      const token = data.session?.access_token || data.access_token;

      if (!token) {
        throw new Error('No se recibio el token de sesion');
      }

      await login(token);
      Alert.alert('Exito', 'Sesion iniciada correctamente');
      router.replace('/');
    } catch (error: unknown) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Ocurrio un error al intentar iniciar sesion';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
          <Menu color={textColor} size={26} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Iniciar sesion</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <ThemedText style={styles.label}>Correo electronico</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: textColor }]}
          value={email}
          onChangeText={setEmail}
          placeholder="ejemplo@correo.com"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          returnKeyType="next"
        />

        <ThemedText style={styles.label}>Contrasena</ThemedText>
        <TextInput
          ref={passwordInputRef}
          style={[styles.input, { color: textColor, borderColor: textColor }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Introduce tu contrasena"
          placeholderTextColor="#888"
          secureTextEntry
          onSubmitEditing={() => { void handleLogin(); }}
          returnKeyType="send"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => {
            void handleLogin();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Entrar</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => router.back()} disabled={loading}>
          <ThemedText style={styles.linkText}>Cancelar</ThemedText>
        </TouchableOpacity>
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
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#0a7ea4',
    fontSize: 16,
  },
});
