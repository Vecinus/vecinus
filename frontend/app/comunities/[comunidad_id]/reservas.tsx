import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  const { comunidad_id } = useLocalSearchParams();
  
  const { zonas, crearReserva, isLoading, fetchZonas, misReservas } = useZonasStore();
  const { communities, activeCommunityId } = useCommunityStore();
  
  const activeCommunity = communities.find(c => c.id === activeCommunityId);
  const isAdminOrPresident = activeCommunity?.role === 1 || activeCommunity?.role === 4;

  const [zonaActivaId, setZonaActivaId] = useState<string>('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (comunidad_id) {
      fetchZonas(comunidad_id as string);
    }
  }, [comunidad_id]);

  useEffect(() => {
    if (zonas.length > 0 && !zonaActivaId) {
      setZonaActivaId(zonas[0].id);
    }
  }, [zonas]);

  const zonaActiva = zonas.find(z => z.id === zonaActivaId);

  const slotsDisponibles = useMemo(() => {
    if (!fechaSeleccionada || !zonaActiva) return [];
    const slots = [];
    const inicio = parseInt(zonaActiva.horaInicio.split(':')[0]);
    const fin = parseInt(zonaActiva.horaFin.split(':')[0]);
    
    for (let i = inicio; i <= fin; i++) {
      const horaStr = `${i < 10 ? `0${i}` : i}:00`;
      
      const isBooked = misReservas.some(
        (reserva) => reserva.zonaId === zonaActiva.id && reserva.fecha === fechaSeleccionada && reserva.hora === horaStr
      );
      
      slots.push({ time: horaStr, isBooked });
    }
    return slots;
  }, [fechaSeleccionada, zonaActivaId, zonaActiva, misReservas]);

  const handleConfirmarReserva = async () => {
    if (!zonaActiva || !fechaSeleccionada || !horaSeleccionada) return;

    const reservaId = await crearReserva({
      zonaId: zonaActiva.id,
      zonaNombre: zonaActiva.nombre,
      fecha: fechaSeleccionada,
      hora: horaSeleccionada,
      requiereQR: zonaActiva.requiereQR
    });

    setModalVisible(false);
    setHoraSeleccionada(null);
    router.push(`/comunities/${comunidad_id}/mis-reservas/${reservaId}` as any);
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
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas` as any)}
      >
        <Text style={styles.actionButtonText}>Mis Reservas</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && zonas.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primaryBlue} />
        <Text style={{ marginTop: 10, color: COLORS.grayText }}>Cargando zonas comunes...</Text>
      </View>
    );
  }

  if (!isLoading && zonas.length === 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Reservas</Text>
            {renderHeaderActions()}
          </View>
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyTitle}>Sin zonas comunes</Text>
            <Text style={styles.emptyStateText}>
              Aún no hay ninguna instalación disponible para reservar en esta comunidad.
            </Text>
            {isAdminOrPresident && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => router.push({ pathname: '/comunities/crear-zona', params: { comunidad_id } })}
              >
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
          <Text style={styles.headerTitle}>Reservas</Text>
          {renderHeaderActions()}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.instalacionesContainer}>
          {zonas.map((zona) => (
            <TouchableOpacity
              key={zona.id}
              style={[styles.instPill, zonaActivaId === zona.id && styles.instPillActive]}
              onPress={() => { setZonaActivaId(zona.id); setHoraSeleccionada(null); }}
            >
              <Text style={[styles.instText, zonaActivaId === zona.id && styles.instTextActive]}>
                {zona.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {zonaActiva && (
          <View style={styles.calendarContainer}>
            <Calendar
              key={zonaActiva.id}
              theme={{
                backgroundColor: COLORS.white,
                calendarBackground: COLORS.white,
                textSectionTitleColor: COLORS.darkBlue,
                selectedDayBackgroundColor: COLORS.primaryBlue,
                selectedDayTextColor: COLORS.white,
                todayTextColor: COLORS.greenCheck,
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                arrowColor: COLORS.primaryBlue,
                monthTextColor: COLORS.darkBlue,
                textMonthFontWeight: 'bold',
              }}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={(day: any) => { setFechaSeleccionada(day.dateString); setHoraSeleccionada(null); }}
              markedDates={{ [fechaSeleccionada]: { selected: true, selectedColor: COLORS.primaryBlue } }}
            />
          </View>
        )}

        {fechaSeleccionada && zonaActiva ? (
          <View style={styles.slotsWrapper}>
            <Text style={styles.sectionTitle}>Horarios disponibles</Text>
            <View style={styles.slotsGrid}>
              {slotsDisponibles.map((slot, index) => {
                const isSelected = horaSeleccionada === slot.time;
                return (
                  <TouchableOpacity
                    key={index}
                    disabled={slot.isBooked}
                    onPress={() => setHoraSeleccionada(slot.time)}
                    style={[
                      styles.slotButton,
                      slot.isBooked && styles.slotBooked,
                      isSelected && styles.slotSelected
                    ]}
                  >
                    <Text style={[
                      styles.slotText,
                      slot.isBooked && styles.slotTextBooked,
                      isSelected && styles.slotTextSelected
                    ]}>
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Selecciona un día en el calendario para ver los horarios disponibles.</Text>
          </View>
        )}
      </ScrollView>

      {horaSeleccionada && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.confirmButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.confirmButtonText}>Reservar ({horaSeleccionada})</Text>
          </TouchableOpacity>
        </View>
      )}

      <CustomModal
        visible={modalVisible}
        title="Confirmar Reserva"
        message={`¿Deseas reservar ${zonaActiva?.nombre} el ${fechaSeleccionada} a las ${horaSeleccionada}?`}
        onCancel={() => setModalVisible(false)}
        onConfirm={handleConfirmarReserva}
        isLoading={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.darkBlue },
  headerActions: { flexDirection: 'row', gap: 10 },
  actionButton: { backgroundColor: COLORS.white, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primaryBlue, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 2 },
  actionButtonText: { color: COLORS.primaryBlue, fontWeight: 'bold', fontSize: 14 },
  emptyStateContainer: { backgroundColor: COLORS.white, padding: 30, borderRadius: 20, alignItems: 'center', marginTop: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 10 },
  createButton: { backgroundColor: COLORS.primaryBlue, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, marginTop: 20 },
  createButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  instalacionesContainer: { flexDirection: 'row', marginBottom: 20 },
  instPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, backgroundColor: COLORS.white, marginRight: 10, borderWidth: 1, borderColor: COLORS.grayBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  instPillActive: { backgroundColor: COLORS.darkBlue, borderColor: COLORS.darkBlue },
  instText: { color: COLORS.grayText, fontWeight: '600', fontSize: 16 },
  instTextActive: { color: COLORS.white },
  calendarContainer: { backgroundColor: COLORS.white, borderRadius: 20, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 24 },
  slotsWrapper: { marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 16 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  slotButton: { width: '30%', paddingVertical: 12, backgroundColor: COLORS.white, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryBlue },
  slotBooked: { backgroundColor: COLORS.grayDisabled, borderColor: COLORS.grayBorder },
  slotSelected: { backgroundColor: COLORS.greenCheck, borderColor: COLORS.greenCheck },
  slotText: { fontSize: 16, color: COLORS.primaryBlue, fontWeight: 'bold' },
  slotTextBooked: { color: '#999', textDecorationLine: 'line-through' },
  slotTextSelected: { color: COLORS.white },
  emptyState: { marginTop: 20, padding: 20, alignItems: 'center' },
  emptyStateText: { color: COLORS.grayText, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(245,249,255,0.9)' },
  confirmButton: { backgroundColor: COLORS.greenCheck, paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 6 },
  confirmButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});