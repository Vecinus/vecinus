import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useZonasStore } from '../../../../store/useZonesStore';
import CustomModal from '../../../../components/ui/CustomModal';

export default function DetalleReservaQR() {
  const { reserva_id, comunidad_id, itemType } = useLocalSearchParams();
  const router = useRouter();
  const { misReservas, misPasesInvitado, zonas, cancelarReserva, cancelarPaseInvitado } = useZonasStore();
  
  const [isCanceling, setIsCanceling] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  let item: any = null;
  let isPase = false;

  if (itemType === 'pase') {
    item = misPasesInvitado.find(p => String(p.id) === String(reserva_id));
    isPase = true;
  } else if (itemType === 'reserva') {
    item = misReservas.find(r => String(r.id) === String(reserva_id));
  } else {
    item = misReservas.find((r) => String(r.id) === String(reserva_id));
    if (!item) {
      item = misPasesInvitado.find((p) => String(p.id) === String(reserva_id));
      isPase = true;
    }
  }

  const zona = item ? zonas.find((z) => String(z.id) === String(item.space_id)) : null;

  if (!item || !zona) {
    if (isCanceling) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#005588" />
          <Text style={{ marginTop: 10, color: '#005588', fontWeight: 'bold' }}>Cancelando...</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Reserva o pase no encontrado</Text>
        <TouchableOpacity onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas` as any)} style={styles.backButton}>
           <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qrValue = isPase 
    ? item.qr_token 
    : (item.qr_code || JSON.stringify({ reservation_id: item.id }));
    
  const fechaFormateada = isPase ? item.valid_for_date : (item.start_at ? item.start_at.split('T')[0] : '');
  const horaFormateada = isPase ? '' : (item.start_at ? item.start_at.split('T')[1].substring(0, 5) : '');

  const executeCancelation = async () => {
    setIsCanceling(true);
    
    try {
      if (isPase) {
        await cancelarPaseInvitado(item.id);
      } else {
        await cancelarReserva(item.id);
      }
      setIsCanceling(false);
      setModalVisible(false);
      router.push(`/comunities/${comunidad_id}/mis-reservas` as any);
    } catch (error: any) {
      setIsCanceling(false);
      setModalVisible(false);
      console.error("Error al cancelar:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Botón de retroceso rápido en la esquina superior */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas` as any)} style={styles.topBackButton}>
          <Text style={styles.topBackButtonText}>← Volver atrás</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>
        {isPase ? '¡Pase Generado!' : '¡Reserva Confirmada!'}
      </Text>
      
      <View style={styles.card}>
        <Text style={styles.instName}>{zona.name}</Text>
        <Text style={styles.itemTypeBadge}>{isPase ? 'Pase de Invitado' : 'Reserva'}</Text>
        
        <Text style={styles.date}>
          {fechaFormateada} {horaFormateada ? ` | ${horaFormateada}` : ''}
        </Text>
        
        {zona.requires_qr || isPase ? (
          <View style={styles.qrContainer}>
            <Text style={styles.instructions}>
              {isPase 
                ? 'Comparte este código QR con tu invitado para que pueda acceder a la instalación el día seleccionado.'
                : 'Muestra este código QR al trabajador o en el torno de acceso.'}
            </Text>
            {qrValue ? (
              <QRCode value={qrValue} size={200} color="#005588" backgroundColor="white" />
            ) : (
              <Text style={{ color: 'red' }}>Error: QR Token no generado</Text>
            )}
            <Text style={styles.idText}>Ref: {String(item.id).toUpperCase()}</Text>
          </View>
        ) : (
          <Text style={styles.instructions}>Esta instalación no requiere código QR para acceder.</Text>
        )}
      </View>

      <TouchableOpacity 
        style={styles.doneButton} 
        onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas` as any)}
      >
        <Text style={styles.doneButtonText}>Ir a Mis Pases/Reservas</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => setModalVisible(true)}
        disabled={isCanceling} 
      >
        <Text style={styles.cancelButtonText}>
          {isPase ? 'Cancelar Pase' : 'Cancelar Reserva'}
        </Text>
      </TouchableOpacity>

      <CustomModal
        visible={modalVisible}
        title={isPase ? "Cancelar Pase" : "Cancelar Reserva"}
        message={isPase 
          ? "¿Estás seguro de que deseas cancelar este pase de invitado? Ya no será válido en los accesos." 
          : "¿Estás seguro de que deseas cancelar esta reserva? Esta acción no se puede deshacer y el horario volverá a estar disponible para otros vecinos."}
        onCancel={() => setModalVisible(false)}
        onConfirm={executeCancelation}
        isLoading={isCanceling} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F9FF', alignItems: 'center', justifyContent: 'center' },
  topBar: { width: '100%', alignItems: 'flex-start', marginBottom: 20, marginTop: 20 },
  topBackButton: { padding: 10, paddingLeft: 0 },
  topBackButtonText: { fontSize: 18, color: '#005588', fontWeight: 'bold' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#88CC00', marginBottom: 20 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  instName: { fontSize: 24, fontWeight: 'bold', color: '#005588', marginBottom: 5, textAlign: 'center' },
  itemTypeBadge: { backgroundColor: '#E6F4FA', color: '#0088CC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold', marginBottom: 15, overflow: 'hidden'},
  date: { fontSize: 18, color: '#666', marginBottom: 20, fontWeight: '600' },
  qrContainer: { alignItems: 'center', marginTop: 10 },
  instructions: { textAlign: 'center', color: '#666', marginBottom: 20, paddingHorizontal: 10 },
  idText: { marginTop: 15, color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  doneButton: { marginTop: 20, padding: 15 },
  doneButtonText: { color: '#0088CC', fontSize: 16, fontWeight: 'bold' },
  errorText: { fontSize: 18, color: 'red', marginBottom: 20 },
  backButton: { padding: 10, backgroundColor: '#ddd', borderRadius: 8 },
  backButtonText: { color: '#333' },
  cancelButton: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 25, backgroundColor: '#FF5252', borderRadius: 12 },
  cancelButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});