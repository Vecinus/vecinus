import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useZonasStore } from '../../../store/useZonesStore';

export default function DetalleReservaQR() {
  const { reserva_id, comunidad_id } = useLocalSearchParams();
  const router = useRouter();
  const { obtenerReservaPorId } = useZonasStore();
  
  const reserva = obtenerReservaPorId(reserva_id as string);

  if (!reserva) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Reserva no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qrValue = JSON.stringify({ id: reserva.id, type: 'invitation' });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Reserva Confirmada!</Text>
      
      <View style={styles.card}>
        <Text style={styles.instName}>{reserva.zonaNombre}</Text>
        <Text style={styles.date}>{reserva.fecha} | {reserva.hora}</Text>
        
        {reserva.requiereQR ? (
          <View style={styles.qrContainer}>
            <Text style={styles.instructions}>
              Muestra este código QR al trabajador o en el torno de acceso.
            </Text>
            <QRCode value={qrValue} size={200} color="#005588" backgroundColor="white" />
            <Text style={styles.idText}>Ref: {reserva.id.toUpperCase()}</Text>
          </View>
        ) : (
          <Text style={styles.instructions}>Esta instalación no requiere código QR para acceder.</Text>
        )}
      </View>

      <TouchableOpacity 
        style={styles.doneButton} 
        onPress={() => router.push(`/comunities/${comunidad_id}/reservas`)}
      >
        <Text style={styles.doneButtonText}>Volver al calendario</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F9FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#88CC00', marginBottom: 20 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  instName: { fontSize: 24, fontWeight: 'bold', color: '#005588', marginBottom: 10 },
  date: { fontSize: 18, color: '#666', marginBottom: 20, fontWeight: '600' },
  qrContainer: { alignItems: 'center', marginTop: 10 },
  instructions: { textAlign: 'center', color: '#666', marginBottom: 20, paddingHorizontal: 10 },
  idText: { marginTop: 15, color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  doneButton: { marginTop: 30, padding: 15 },
  doneButtonText: { color: '#0088CC', fontSize: 16, fontWeight: 'bold' },
  errorText: { fontSize: 18, color: 'red', marginBottom: 20 },
  backButton: { padding: 10, backgroundColor: '#ddd', borderRadius: 8 },
  backButtonText: { color: '#333' }
});