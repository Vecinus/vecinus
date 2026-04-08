import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useZonasStore } from '../../store/useZonesStore';
import CustomModal from '../../components/ui/CustomModal';

const COLORS = { primaryBlue: '#0088CC', white: '#FFFFFF', grayText: '#666666', grayBorder: '#E0E0E0', lightBackground: '#F5F9FF' };

export default function CrearZonaComun() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const comunidad_id = params.comunidad_id as string || params.id as string;
  const { crearZona, isLoading } = useZonasStore();

  const [nombre, setNombre] = useState('');
  const [aforo, setAforo] = useState('');
  const [requiereQR, setRequiereQR] = useState(false);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('21:00');
  const [usageMode, setUsageMode] = useState<'exclusive_reservation' | 'guest_pass'>('exclusive_reservation');
  const [maxGuests, setMaxGuests] = useState('1');
  
  const [modalVisible, setModalVisible] = useState(false);

  const handleCrearZona = async () => {
    await crearZona(comunidad_id, { 
      name: nombre, 
      capacity: parseInt(aforo) || 1, 
      requires_qr: requiereQR, 
      start_time: horaInicio, 
      end_time: horaFin,
      usage_mode: usageMode,
      max_guests_per_reservation: parseInt(maxGuests) || 1
    } as any);
    
    setModalVisible(false);
    if (router.canGoBack()) {
      router.push(`/comunities/${comunidad_id}/reservas` as any);
    } else {
      router.replace(`/comunities/${comunidad_id}/reservas` as any);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.push(`/comunities/${comunidad_id}/reservas` as any)} style={styles.backIcon}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nueva Zona Común</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nombre de la instalación</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Piscina Comunitaria" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Modo de uso</Text>
          <View style={styles.modeContainer}>
            <TouchableOpacity 
              style={[styles.modeButton, usageMode === 'exclusive_reservation' && styles.modeButtonActive]}
              onPress={() => setUsageMode('exclusive_reservation')}
            >
              <Text style={[styles.modeText, usageMode === 'exclusive_reservation' && styles.modeTextActive]}>Reserva Exclusiva</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeButton, usageMode === 'guest_pass' && styles.modeButtonActive]}
              onPress={() => setUsageMode('guest_pass')}
            >
              <Text style={[styles.modeText, usageMode === 'guest_pass' && styles.modeTextActive]}>Pase Invitado</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Aforo máximo permitido</Text>
          <TextInput style={styles.input} value={aforo} onChangeText={setAforo} keyboardType="numeric" placeholder="Ej. 50" />
        </View>

        {usageMode === 'guest_pass' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Máximo de invitados por pase</Text>
            <TextInput style={styles.input} value={maxGuests} onChangeText={setMaxGuests} keyboardType="numeric" placeholder="Ej. 2" />
          </View>
        )}

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>Hora Apertura</Text>
            <TextInput style={styles.input} value={horaInicio} onChangeText={setHoraInicio} placeholder="09:00" />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.label}>Hora Cierre</Text>
            <TextInput style={styles.input} value={horaFin} onChangeText={setHoraFin} placeholder="21:00" />
          </View>
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>¿Requiere invitación (QR) para acceder?</Text>
          <Switch value={requiereQR} onValueChange={setRequiereQR} trackColor={{ true: COLORS.primaryBlue }} />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, !nombre && styles.saveButtonDisabled]} 
          onPress={() => setModalVisible(true)}
          disabled={!nombre}
        >
          <Text style={styles.saveButtonText}>Crear Zona Común</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <CustomModal
        visible={modalVisible}
        title="Crear nueva zona"
        message={`¿Estás seguro de crear la instalación "${nombre}"?`}
        onCancel={() => setModalVisible(false)}
        onConfirm={handleCrearZona}
        isLoading={isLoading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground, padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backIcon: { marginRight: 15, padding: 5 },
  backIconText: { fontSize: 28, color: '#005588', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#005588' },
  formGroup: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 16, color: COLORS.grayText, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.grayBorder, borderRadius: 10, padding: 12, fontSize: 16 },
  modeContainer: { flexDirection: 'row', gap: 10 },
  modeButton: { flex: 1, padding: 12, borderWidth: 1, borderColor: COLORS.primaryBlue, borderRadius: 10, alignItems: 'center' },
  modeButtonActive: { backgroundColor: COLORS.primaryBlue },
  modeText: { color: COLORS.primaryBlue, fontWeight: 'bold' },
  modeTextActive: { color: COLORS.white },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15, padding: 15, backgroundColor: COLORS.white, borderRadius: 10 },
  saveButton: { backgroundColor: COLORS.primaryBlue, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { backgroundColor: '#A0D0E8' },
  saveButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});