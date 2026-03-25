import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';

import { useZonasStore } from '../../../store/useZonesStore';
import { useCommunityStore } from '../../../store/useCommunityStore';
import CustomModal from '../../../components/ui/CustomModal';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

const COLORS = {
  primaryBlue: '#0088CC', 
  darkBlue: '#005588',    
  greenCheck: '#88CC00',  
  lightBackground: '#F5F9FF',
  white: '#FFFFFF',
  grayText: '#666666',
  grayBorder: '#E0E0E0',
  redBooked: '#FF5252',
  grayDisabled: '#F0F0F0',
};

export default function ReservasComunidad() {
  const router = useRouter();
  const navigation = useNavigation();
  const { comunidad_id } = useLocalSearchParams();
  
  const { zonas, crearReserva, crearPaseInvitado, eliminarZona, isLoading, fetchZonas, obtenerHorariosOcupados } = useZonasStore();
  const { communities, activeCommunityId } = useCommunityStore();
  
  const activeCommunity = communities.find(c => c.id === activeCommunityId);
  const isAdminOrPresident = activeCommunity?.role === 1 || activeCommunity?.role === 4;
  const isWorker = activeCommunity?.role === 5; 

  const [zonaActivaId, setZonaActivaId] = useState<string | number>('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [horariosOcupados, setHorariosOcupados] = useState<any[]>([]);

  useEffect(() => {
    if (comunidad_id) fetchZonas(comunidad_id as string);
  }, [comunidad_id]);

  useEffect(() => {
    if (zonas.length > 0 && (!zonaActivaId || !zonas.find(z => String(z.id) === String(zonaActivaId)))) {
      setZonaActivaId(zonas[0].id);
      setHoraSeleccionada(null);
    }
  }, [zonas]);

  const zonaActiva = zonas.find(z => String(z.id) === String(zonaActivaId));
  const modoUso = (zonaActiva as any)?.usage_mode;
  const esModoExclusivo = modoUso === 'exclusive_reservation'; 

  useEffect(() => {
    if (fechaSeleccionada && zonaActivaId && esModoExclusivo && !isWorker) {
      obtenerHorariosOcupados(zonaActivaId, fechaSeleccionada).then((slots) => {
        setHorariosOcupados(slots || []);
      });
    } else {
      setHorariosOcupados([]);
    }
  }, [fechaSeleccionada, zonaActivaId, esModoExclusivo, isWorker]);

  const slotsDisponibles = useMemo(() => {
    if (!fechaSeleccionada || !zonaActiva || !esModoExclusivo) return [];
    
    const slots = [];
    const inicioStr = zonaActiva.start_time || '09:00';
    const finStr = zonaActiva.end_time || '21:00';
    
    const inicio = parseInt(inicioStr.split(':')[0]);
    const fin = parseInt(finStr.split(':')[0]);
    
    for (let i = inicio; i <= fin; i++) {
      const horaStr = `${i < 10 ? `0${i}` : i}:00`;
      
      const isBooked = horariosOcupados.some(slot => {
        if (!slot.start_at) return false;
        const slotTime = slot.start_at.split('T')[1].substring(0, 5);
        return slotTime === horaStr;
      });

      slots.push({ time: horaStr, isBooked });
    }
    return slots;
  }, [fechaSeleccionada, zonaActiva, horariosOcupados, esModoExclusivo]);

  const handleConfirmarAccion = async () => {
    if (!zonaActiva || !fechaSeleccionada || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      let response;
      if (esModoExclusivo && horaSeleccionada) {
        const horaFinNum = parseInt(horaSeleccionada.split(':')[0]) + 1;
        const horaFinStr = `${horaFinNum < 10 ? `0${horaFinNum}` : horaFinNum}:00`;
        const startAt = `${fechaSeleccionada}T${horaSeleccionada}:00`;

        response = await crearReserva({
          space_id: Number(zonaActiva.id),
          start_at: startAt,
          end_at: `${fechaSeleccionada}T${horaFinStr}:00`,
          guests_count: "0"
        });

        setHorariosOcupados(prev => [...prev, { start_at: startAt }]);
        
      } else if (!esModoExclusivo) {
        response = await crearPaseInvitado({
          space_id: Number(zonaActiva.id),
          valid_for_date: fechaSeleccionada
        });
      }

      setModalVisible(false);
      setHoraSeleccionada(null);
      
      if (response) {
        router.push(`/comunities/${comunidad_id}/mis-reservas/${response.id}` as any);
      } else {
        router.push(`/comunities/${comunidad_id}/mis-reservas` as any);
      }
    } catch (error: any) {
      setModalVisible(false);
      Alert.alert("Error", error.message || "Ocurrió un error inesperado al realizar la acción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!zonaActivaId || !comunidad_id) return;
    
    setIsDeleting(true);
    try {
      await eliminarZona(comunidad_id as string, zonaActivaId);
      setDeleteModalVisible(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se ha podido eliminar la zona.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderHeaderActions = () => (
    <View style={styles.headerActions}>
      {isAdminOrPresident && (
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/comunities/crear-zona', params: { comunidad_id } })}
        >
          <Text style={styles.actionButtonText}>+ Zona</Text>
        </TouchableOpacity>
      )}
      {!isWorker && (
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas` as any)}
        >
          <Text style={styles.actionButtonText}>Mis Pases/Reservas</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading && zonas.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primaryBlue} />
      </View>
    );
  }

  if (isWorker) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <TouchableOpacity 
                onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} 
                style={styles.menuIcon}
                hitSlop={10}
              >
                <Menu color={COLORS.darkBlue} size={28} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Accesos</Text>
            </View>
          </View>
          
          <View style={styles.workerContainer}>
            <View style={styles.workerCard}>
              <Text style={styles.workerCardTitle}>Validación de QR</Text>
              <Text style={styles.workerCardDesc}>
                Escanea los códigos QR de los vecinos o invitados para comprobar si tienen una reserva o pase válido para acceder a las instalaciones.
              </Text>
              <TouchableOpacity 
                style={styles.scannerButton} 
                onPress={() => router.push(`/comunities/${comunidad_id}/worker/escaner` as any)}
              >
                <Text style={styles.scannerButtonText}>Abrir Escáner</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!isLoading && zonas.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <TouchableOpacity 
                onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} 
                style={styles.menuIcon}
                hitSlop={10}
              >
                <Menu color={COLORS.darkBlue} size={28} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Reservas</Text>
            </View>
            {renderHeaderActions()}
          </View>
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyTitle}>Sin zonas comunes</Text>
            <Text style={styles.emptyStateText}>No hay instalaciones disponibles.</Text>
            {isAdminOrPresident && (
              <TouchableOpacity style={styles.createButton} onPress={() => router.push({ pathname: '/comunities/crear-zona', params: { comunidad_id } })}>
                <Text style={styles.createButtonText}>+ Crear nueva zona</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <TouchableOpacity 
              onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} 
              style={styles.menuIcon}
              hitSlop={10}
            >
              <Menu color={COLORS.darkBlue} size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Reservas</Text>
          </View>
          {renderHeaderActions()}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.instalacionesContainer}>
          {zonas.map((zona) => (
            <TouchableOpacity
              key={zona.id}
              style={[styles.instPill, String(zonaActivaId) === String(zona.id) && styles.instPillActive]}
              onPress={() => { setZonaActivaId(zona.id); setHoraSeleccionada(null); }}
            >
              <Text style={[styles.instText, String(zonaActivaId) === String(zona.id) && styles.instTextActive]}>
                {zona.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isAdminOrPresident && zonaActiva && (
          <View style={styles.adminActionsContainer}>
             <Text style={styles.adminInfoText}>Administración de instalación:</Text>
             <View style={styles.adminButtonsRow}>
               <TouchableOpacity 
                 style={styles.editZoneButton} 
                 onPress={() => router.push({ pathname: '/comunities/editar-zona', params: { comunidad_id, zona_id: zonaActiva.id } })}
               >
                  <Text style={styles.editZoneButtonText}>Editar</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.deleteZoneButton} onPress={() => setDeleteModalVisible(true)}>
                  <Text style={styles.deleteZoneButtonText}>Eliminar</Text>
               </TouchableOpacity>
             </View>
          </View>
        )}

        {zonaActiva && (
          <View style={styles.calendarContainer}>
            <Calendar
              key={zonaActiva.id}
              theme={{
                selectedDayBackgroundColor: COLORS.primaryBlue,
                todayTextColor: COLORS.greenCheck,
                arrowColor: COLORS.primaryBlue,
              }}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={(day: any) => { setFechaSeleccionada(day.dateString); setHoraSeleccionada(null); }}
              markedDates={{ [fechaSeleccionada]: { selected: true, selectedColor: COLORS.primaryBlue } }}
            />
          </View>
        )}

        {Boolean(fechaSeleccionada) && esModoExclusivo && (
          <View style={styles.slotsWrapper}>
            <Text style={styles.sectionTitle}>Horarios disponibles</Text>
            <View style={styles.slotsGrid}>
              {slotsDisponibles.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  disabled={slot.isBooked}
                  onPress={() => setHoraSeleccionada(slot.time)}
                  style={[styles.slotButton, slot.isBooked && styles.slotBooked, horaSeleccionada === slot.time && styles.slotSelected]}
                >
                  <Text style={[styles.slotText, slot.isBooked && styles.slotTextBooked, horaSeleccionada === slot.time && styles.slotTextSelected]}>
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {Boolean((esModoExclusivo && horaSeleccionada) || (!esModoExclusivo && fechaSeleccionada)) && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={() => setModalVisible(true)}
            disabled={isSubmitting}
          >
            <Text style={styles.confirmButtonText}>
              {!esModoExclusivo ? 'Generar Pase de Invitado' : `Reservar (${horaSeleccionada})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <CustomModal
        visible={modalVisible}
        title={!esModoExclusivo ? "Generar Pase" : "Confirmar Reserva"}
        message={!esModoExclusivo 
          ? `¿Deseas generar un pase de invitado para ${zonaActiva?.name} el ${fechaSeleccionada}?` 
          : `¿Deseas reservar ${zonaActiva?.name} el ${fechaSeleccionada} a las ${horaSeleccionada}?`}
        onCancel={() => setModalVisible(false)}
        onConfirm={handleConfirmarAccion}
        isLoading={isSubmitting || isLoading}
      />

      <CustomModal
        visible={deleteModalVisible}
        title="Eliminar Instalación"
        message={`¿Estás seguro de que deseas eliminar permanentemente la instalación "${zonaActiva?.name}"? Esta acción borrará el calendario y no se puede deshacer.`}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteZone}
        isLoading={isDeleting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { marginRight: 15, padding: 5, justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#005588' },
  headerActions: { flexDirection: 'row', gap: 10 },
  actionButton: { backgroundColor: COLORS.white, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primaryBlue },
  actionButtonText: { color: COLORS.primaryBlue, fontWeight: 'bold', fontSize: 14 },
  emptyStateContainer: { backgroundColor: COLORS.white, padding: 30, borderRadius: 20, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 10 },
  createButton: { backgroundColor: COLORS.primaryBlue, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, marginTop: 20 },
  createButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  instalacionesContainer: { flexDirection: 'row', marginBottom: 20 },
  instPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, backgroundColor: COLORS.white, marginRight: 10, borderWidth: 1, borderColor: COLORS.grayBorder },
  instPillActive: { backgroundColor: COLORS.darkBlue, borderColor: COLORS.darkBlue },
  instText: { color: COLORS.grayText, fontWeight: '600', fontSize: 16 },
  instTextActive: { color: COLORS.white },
  
  adminActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  adminInfoText: { fontSize: 14, color: COLORS.grayText, fontWeight: '500' },
  adminButtonsRow: { flexDirection: 'row', gap: 10 },
  editZoneButton: { backgroundColor: '#E6F4FA', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primaryBlue },
  editZoneButtonText: { color: COLORS.primaryBlue, fontWeight: 'bold', fontSize: 12 },
  deleteZoneButton: { backgroundColor: '#FFEDED', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FF5252' },
  deleteZoneButtonText: { color: '#FF5252', fontWeight: 'bold', fontSize: 12 },

  calendarContainer: { backgroundColor: COLORS.white, borderRadius: 20, padding: 10, marginBottom: 24 },
  slotsWrapper: { marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 16 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotButton: { width: '30%', paddingVertical: 12, backgroundColor: COLORS.white, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryBlue },
  slotBooked: { backgroundColor: COLORS.grayDisabled, borderColor: COLORS.grayBorder },
  slotSelected: { backgroundColor: COLORS.greenCheck, borderColor: COLORS.greenCheck },
  slotText: { fontSize: 16, color: COLORS.primaryBlue, fontWeight: 'bold' },
  slotTextBooked: { color: '#999', textDecorationLine: 'line-through' },
  slotTextSelected: { color: COLORS.white },
  emptyStateText: { color: COLORS.grayText, textAlign: 'center', fontSize: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(245,249,255,0.9)' },
  confirmButton: { backgroundColor: COLORS.greenCheck, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  confirmButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },

  workerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  workerCard: { backgroundColor: COLORS.white, padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  workerCardTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 15 },
  workerCardDesc: { fontSize: 16, color: COLORS.grayText, textAlign: 'center', marginBottom: 30, lineHeight: 24 },
  scannerButton: { backgroundColor: COLORS.primaryBlue, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  scannerButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});