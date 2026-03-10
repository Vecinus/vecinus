import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL } from '@/constants/api';
// Ajusta esta importación según cómo manejes tu instancia de API (axios/fetch)
// import api from '../../constants/api'; 

export default function AcceptInvitationScreen() {
  // Capturamos el token de la URL automáticamente
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <View className="flex-1 justify-center items-center bg-[#eef4f7]">
        <Text className="text-red-500 font-bold text-lg">Error: No se encontró el token de la invitación.</Text>
      </View>
    );
  }

  const handleAccept = async () => {
    if (!password || password.length < 6) {
      Alert.alert("Atención", "Por favor, introduce una contraseña de al menos 6 caracteres.");
      return;
    }

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

      Alert.alert(
        "¡Comunidad unida!",
        data.is_new_user 
          ? "Tu cuenta ha sido creada y te has unido a la comunidad con éxito." 
          : "¡Bienvenido de nuevo! Te has unido a esta nueva comunidad exitosamente.",
        [{ text: "Ir a Iniciar Sesión", onPress: () => router.replace('/auth/login') }]
      );
      
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-[#eef4f7]">
      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <Text className="text-2xl font-bold text-center text-[#11181C] mb-2">
          Aceptar Invitación
        </Text>
        <Text className="text-center text-[#687076] mb-6 leading-5">
          Para aceptar la invitación, necesitamos una contraseña.{"\n\n"}
          <Text className="font-bold">¿Eres nuevo?</Text> Crea tu contraseña.{"\n"}
          <Text className="font-bold">¿Ya tienes cuenta?</Text> Introduce tu contraseña actual.
        </Text>

        <TextInput
          className="border border-gray-300 rounded-lg p-4 mb-6 text-[#11181C] text-base bg-gray-50"
          placeholder="Tu contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        <TouchableOpacity
          className="bg-[#3aab5e] py-4 rounded-lg items-center"
          onPress={handleAccept}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-lg">Aceptar Invitación</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}