import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useZonasStore } from '../../../../store/useZonesStore';

export default function EscanerTrabajador() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const { validarAccesoQR } = useZonasStore();

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isValidating) return;
    
    setScanned(true);
    setIsValidating(true);
    
    try {
      const accesoPermitido = await validarAccesoQR(data);
      
      if (accesoPermitido) {
        Alert.alert('✅ Acceso Permitido', 'La reserva es válida y corresponde a este horario.', [
          { text: 'Siguiente escaneo', onPress: () => { setScanned(false); setIsValidating(false); } }
        ]);
      } else {
        Alert.alert('❌ Error', 'El código QR no es válido, está caducado o no corresponde a este horario.', [
          { text: 'Reintentar', onPress: () => { setScanned(false); setIsValidating(false); } }
        ]);
      }
    } catch(e) {
      Alert.alert('Error de conexión', 'No se pudo verificar el código con el servidor.', [
        { text: 'Reintentar', onPress: () => { setScanned(false); setIsValidating(false); } }
      ]);
    }
  };

  if (!permission) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#0088CC" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textError}>No hay acceso a la cámara</Text>
        <Button title="Conceder Permiso" onPress={requestPermission} color="#0088CC" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Validación de Accesos</Text>
      
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
        {isValidating && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Validando en servidor...</Text>
          </View>
        )}
      </View>

      {scanned && !isValidating && (
        <View style={styles.rescanButton}>
          <Button title="Toca para escanear de nuevo" onPress={() => setScanned(false)} color="#0088CC" />
        </View>
      )}
      
      <View style={styles.closeButton}>
        <Button title="Volver" onPress={() => router.back()} color="#FF5252" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', padding: 20 },
  container: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', position: 'absolute', top: 60 },
  textError: { color: 'white', fontSize: 16, marginBottom: 20 },
  scannerContainer: { width: 300, height: 300, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#0088CC', position: 'relative' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'white', marginTop: 10, fontWeight: 'bold' },
  rescanButton: { position: 'absolute', bottom: 100, backgroundColor: 'white', borderRadius: 10, padding: 5 },
  closeButton: { position: 'absolute', bottom: 40, backgroundColor: 'white', borderRadius: 10, padding: 5 }
});