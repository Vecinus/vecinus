import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';

export default function EscanerTrabajador() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    
    try {
      // Intentamos parsear la data del QR (en un entorno real se verifica el token contra el servidor)
      const ticketInfo = JSON.parse(data);
      
      if(ticketInfo.type === 'invitation') {
        Alert.alert('Acceso Permitido', `Invitación válida. ID Reserva: ${ticketInfo.id}`, [
          { text: 'Siguiente escaneo', onPress: () => setScanned(false) }
        ]);
      } else {
        Alert.alert('Error', 'Código QR no reconocido como invitación válida', [
          { text: 'Reintentar', onPress: () => setScanned(false) }
        ]);
      }
    } catch(e) {
      Alert.alert('Error', 'Formato de QR inválido', [
        { text: 'Reintentar', onPress: () => setScanned(false) }
      ]);
    }
  };

  if (hasPermission === null) return <Text>Solicitando permiso de cámara...</Text>;
  if (hasPermission === false) return <Text>No hay acceso a la cámara</Text>;

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
      </View>
      {scanned && (
        <View style={styles.rescanButton}>
          <Button title="Toca para escanear de nuevo" onPress={() => setScanned(false)} color="#0088CC" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', position: 'absolute', top: 60 },
  scannerContainer: { width: 300, height: 300, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#0088CC' },
  rescanButton: { position: 'absolute', bottom: 50, backgroundColor: 'white', borderRadius: 10, padding: 5 }
});