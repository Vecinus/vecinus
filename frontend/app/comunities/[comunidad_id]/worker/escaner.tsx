import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useZonasStore } from '../../../../store/useZonesStore';
import CustomModal from '../../../../components/ui/CustomModal';

export default function EscanerTrabajador() {
  const router = useRouter();
  const { comunidad_id } = useLocalSearchParams();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  // Estados para controlar el modal de resultado
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const { validarAccesoQR } = useZonasStore();

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isValidating) return;
    
    setScanned(true);
    setIsValidating(true);
    
    try {
      const response = await validarAccesoQR(data, comunidad_id as string) as any;
      setIsValidating(false); // Ocultamos el spinner del escáner
      
      if (response.valid) {
        let msg = 'Acceso concedido.';
        if (response.data) {
          msg = `Instalación: ${response.data.space_name || 'N/A'}\nPersonas permitidas: ${response.data.guests_count || 1}\nTipo: ${response.data.type === 'guest_pass' ? 'Pase Invitado' : 'Reserva'}`;        }
        setModalTitle('✅ Acceso Permitido');
        setModalMessage(msg);
      } else {
        setModalTitle('❌ Acceso Denegado');
        
        // Manejamos los posibles formatos de error del backend de forma segura
        let errorMessage = 'El código QR no es válido o está caducado.';
        if (typeof response.message === 'string') {
          errorMessage = response.message;
        } else if (response.message?.msg) {
          errorMessage = response.message.msg;
        } else if (response.message?.detail) {
          errorMessage = typeof response.message.detail === 'string' 
            ? response.message.detail 
            : JSON.stringify(response.message.detail);
        }
        
        setModalMessage(errorMessage);
      }
      
      setModalVisible(true);
    } catch(e: any) {
      setIsValidating(false);
      setModalTitle('⚠️ Error de conexión');
      setModalMessage(e.message || 'No se pudo verificar el código con el servidor.');
      setModalVisible(true);
    }
  };

  // Función para cerrar el modal y preparar el siguiente escaneo
  const handleNextScan = () => {
    setModalVisible(false);
    setScanned(false);
    setIsValidating(false);
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

      {/* MODAL DE RESULTADO */}
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onConfirm={handleNextScan}
        onCancel={handleNextScan} // Si pican fuera, también reinicia el escáner
      />
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