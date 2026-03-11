import { API_URL } from '@/constants/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Key } from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore'; // <-- 1. Importar Zustand Auth Store

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const login = useAuthStore((state) => state.login); // <-- 2. Obtenemos la función de login

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!token) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.centerContent}>
          <Image 
            source={require('@/assets/logos/VecinusLogotipoTransparente.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.errorTitle}>Error de Invitación</Text>
              <Text style={styles.cardSubtitle}>No se encontró el token de la invitación en el enlace.</Text>
            </View>
            <TouchableOpacity style={styles.submitButton} onPress={() => router.replace('/auth/login')}>
              <Text style={styles.submitButtonText}>Ir a Iniciar Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const handleAccept = async () => {
    if (!password || password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setErrorMessage(''); 
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/auth/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_token: token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al aceptar la invitación");
      }

      // <-- 3. Inyectar el token en tu Zustand y redirigir
      if (data.token) {
        login(data.token);
        router.replace('/(tabs)'); // Redirige a tu layout principal autenticado
      } else {
        // Fallback por si en algún momento se requiere confirmación por email en el futuro
        router.replace('/auth/login');
      }
      
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.centerContent}>
        <Image 
          source={require('@/assets/logos/VecinusLogotipoTransparente.png')} 
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Aceptar Invitación</Text>
            <Text style={styles.cardSubtitle}>
              Para aceptar la invitación, necesitamos que configures tu acceso.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={[styles.inputContainer, errorMessage ? styles.inputContainerError : null]}>
              <Key color={errorMessage ? "#EF4444" : "#94A3B8"} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Introduce tu contraseña"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                autoCapitalize="none"
              />
            </View>
            {errorMessage ? (
              <Text style={styles.errorTextInline}>{errorMessage}</Text>
            ) : null}
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Aceptar Invitación</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ... Mantén tus 'styles' exactamente como los tenías ...

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 220,
    height: 70,
    alignSelf: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    height: '100%',
  },
  errorTextInline: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    marginLeft: 4,
  },
  buttonGroup: {
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});