import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { bookingApi } from '@/api/booking';
import { AlertConfig, CustomAlertDialog } from '@/components/custom-alert';

export default function ScannerScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams();
  const isFocused = useIsFocused();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'success'
  });

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isValidating) return;
    
    setScanned(true);
    setIsValidating(true);
    
    try {
      const response = await bookingApi.validateQr({
        qr_token: data,
        association_id: communityId as string
      });
      
      setIsValidating(false);
      
      const msg = `Instalación: ${response.space_name || 'N/A'}\nPersonas permitidas: ${response.guests_count || 1}\nTipo: ${response.type === 'guest_pass' ? 'Pase Invitado' : 'Reserva'}`;
      
      setAlertConfig({
        visible: true,
        title: '✅ Acceso Permitido',
        message: msg,
        type: 'success'
      });
      
    } catch(error: any) {
      setIsValidating(false);
      
      let errorMessage = 'El código QR no es válido o está caducado.';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        } else if (typeof errorData.detail === 'object') {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAlertConfig({
        visible: true,
        title: '❌ Acceso Denegado',
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const handleNextScan = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    setScanned(false);
    setIsValidating(false);
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-5">
        <ActivityIndicator size="large" color="#0088CC" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-5">
        <Text className="text-foreground text-base mb-5">No hay acceso a la cámara</Text>
        <Button onPress={requestPermission}>
          <Text className="text-primary-foreground">Conceder Permiso</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Text className="text-2xl text-foreground font-bold absolute top-16">
        Validación de Accesos
      </Text>
      
      <View className="w-72 h-72 rounded-2xl overflow-hidden border-2 border-primary relative">
        {isFocused && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
        )}
        {isValidating && (
          <View className="absolute inset-0 bg-black/70 justify-center items-center">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-white mt-2 font-bold">Validando en servidor...</Text>
          </View>
        )}
      </View>

      {scanned && !isValidating && (
        <View className="absolute bottom-32 bg-card rounded-xl">
          <Button onPress={() => setScanned(false)} variant="secondary">
            <Text className="text-secondary-foreground">Toca para escanear de nuevo</Text>
          </Button>
        </View>
      )}
      
      <View className="absolute bottom-10 bg-card rounded-xl">
        <Button onPress={() => router.push(`/${communityId}/booking`)} variant="destructive">
          <Text className="text-destructive-foreground">Volver</Text>
        </Button>
      </View>

      <CustomAlertDialog
        config={alertConfig}
        onConfirm={() => {}}
        onCancel={handleNextScan}
        onAcknowledge={handleNextScan}
      />
    </View>
  );
}