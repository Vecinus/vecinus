import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useZonasStore } from '../../store/useZonesStore';
import CustomModal from '../../components/ui/CustomModal';

const COLORS = { primaryBlue: '#0088CC', white: '#FFFFFF', grayText: '#666666', grayBorder: '#E0E0E0', lightBackground: '#F5F9FF' };

export default function CrearZonaComun() {
  const router = useRouter();
  const { crearZona, isLoading } = useZonasStore();

  const [nombre, setNombre] = useState('');
  const [aforo, setAforo] = useState('');
  const [requiereQR, setRequiereQR] = useState(false);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('21:00');
  
  const [modalVisible, setModalVisible] = useState(false);

  const handleCrearZona = async () => {
    await crearZona({ nombre, aforo: parseInt(aforo) || 1, requiereQR, horaInicio, horaFin });
    setModalVisible(false);
    router.back();
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Nueva Zona Común</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nombre de la instalación</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Pista de Pádel 2" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Aforo máximo permitido</Text>
          <TextInput style={styles.input} value={aforo} onChangeText={setAforo} keyboardType="numeric" placeholder="Ej. 4" />
        </View>

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
  container: { flex: 1, backgroundColor: COLORS.lightBackground, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#005588', marginBottom: 20 },
  formGroup: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 16, color: COLORS.grayText, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.grayBorder, borderRadius: 10, padding: 12, fontSize: 16 },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15, padding: 15, backgroundColor: COLORS.white, borderRadius: 10 },
  saveButton: { backgroundColor: COLORS.primaryBlue, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { backgroundColor: '#A0D0E8' },
  saveButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});