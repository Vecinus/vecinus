import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// 1. Configurar el calendario en Español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

// Colores de tu marca
const COLORS = {
  primaryBlue: '#0088CC', 
  darkBlue: '#005588',    
  greenCheck: '#88CC00',  
  lightBackground: '#F5F9FF',
  white: '#FFFFFF',
  grayText: '#666666',
  grayBorder: '#E0E0E0',
  redBooked: '#FF5252', // Rojo para horas ocupadas
  grayDisabled: '#F0F0F0',
};

// Tipos
type Instalacion = 'Pádel' | 'Piscina' | 'Fútbol Sala' | 'Tenis';

interface TimeSlot {
  time: string;
  isBooked: boolean;
}

const INSTALACIONES: Instalacion[] = ['Pádel', 'Piscina', 'Fútbol Sala', 'Tenis'];

export default function ReservasComunidad() {
  const [instalacionActiva, setInstalacionActiva] = useState<Instalacion>('Pádel');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);

  // Generador de horas simuladas (en un caso real, esto vendría de tu API al elegir un día)
  const slotsDisponibles = useMemo<TimeSlot[]>(() => {
    if (!fechaSeleccionada) return [];
    
    const slots: TimeSlot[] = [];
    // Simulamos horas de 09:00 a 21:00
    for (let i = 9; i <= 21; i++) {
      const horaStr = `${i < 10 ? `0${i}` : i}:00`;
      // Simulamos aleatoriamente que algunas horas ya están reservadas (solo para la UI)
      // Usamos la longitud de la fecha + hora para que sea pseudo-aleatorio pero consistente
      const isBooked = (fechaSeleccionada.length + i) % 3 === 0; 
      slots.push({ time: horaStr, isBooked });
    }
    return slots;
  }, [fechaSeleccionada, instalacionActiva]);

  // Manejador para confirmar la reserva
  const confirmarReserva = () => {
    if (!fechaSeleccionada || !horaSeleccionada) return;
    
    Alert.alert(
      "Confirmar Reserva",
      `¿Deseas reservar la pista de ${instalacionActiva} el día ${fechaSeleccionada} a las ${horaSeleccionada}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, reservar", 
          onPress: () => {
            Alert.alert("¡Reserva Confirmada!", "Recuerda ser puntual.");
            setHoraSeleccionada(null); 
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      <Text style={styles.headerTitle}>Reservas</Text>

      {/* 2. Selector de Instalación (Pistas) */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.instalacionesContainer}
      >
        {INSTALACIONES.map((inst) => (
          <TouchableOpacity
            key={inst}
            style={[
              styles.instPill,
              instalacionActiva === inst && styles.instPillActive
            ]}
            onPress={() => {
              setInstalacionActiva(inst);
              setHoraSeleccionada(null);
            }}
          >
            <Text style={[
              styles.instText,
              instalacionActiva === inst && styles.instTextActive
            ]}>
              {inst}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 3. Componente de Calendario */}
      <View style={styles.calendarContainer}>
        <Calendar
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
          onDayPress={(day: any) => {
            setFechaSeleccionada(day.dateString);
            setHoraSeleccionada(null); 
          }}
          markedDates={{
            [fechaSeleccionada]: { 
              selected: true, 
              disableTouchEvent: true, 
              selectedColor: COLORS.primaryBlue 
            }
          }}
        />
      </View>

      {/* 4. Selector de Horas (Solo se muestra si hay un día seleccionado) */}
      {fechaSeleccionada ? (
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

      {/* 5. Botón Flotante de Confirmación */}
      {horaSeleccionada && (
        <TouchableOpacity style={styles.confirmButton} onPress={confirmarReserva}>
          <Text style={styles.confirmButtonText}>
            Confirmar Reserva ({horaSeleccionada})
          </Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100, 
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.darkBlue,
    marginBottom: 24,
  },
  instalacionesContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  instPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  instPillActive: {
    backgroundColor: COLORS.darkBlue,
    borderColor: COLORS.darkBlue,
  },
  instText: {
    color: COLORS.grayText,
    fontWeight: '600',
    fontSize: 16,
  },
  instTextActive: {
    color: COLORS.white,
  },
  calendarContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 24,
  },
  slotsWrapper: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.darkBlue,
    marginBottom: 16,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  slotButton: {
    width: '30%', 
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBlue,
  },
  slotBooked: {
    backgroundColor: COLORS.grayDisabled,
    borderColor: COLORS.grayBorder,
  },
  slotSelected: {
    backgroundColor: COLORS.greenCheck,
    borderColor: COLORS.greenCheck,
  },
  slotText: {
    fontSize: 16,
    color: COLORS.primaryBlue,
    fontWeight: 'bold',
  },
  slotTextBooked: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  slotTextSelected: {
    color: COLORS.white,
  },
  emptyState: {
    marginTop: 20,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: COLORS.grayText,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  confirmButton: {
    backgroundColor: COLORS.greenCheck,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: COLORS.greenCheck,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  }
});