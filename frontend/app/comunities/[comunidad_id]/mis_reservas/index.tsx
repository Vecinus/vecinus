import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
// NOTA: Hemos añadido un ../ extra porque ahora estamos más profundo en las carpetas
import { useZonasStore } from '../../../../store/useZonesStore';

const COLORS = {
  primaryBlue: '#0088CC',
  darkBlue: '#005588',
  white: '#FFFFFF',
  grayText: '#666666',
  grayBorder: '#E0E0E0',
  lightBackground: '#F5F9FF'
};

export default function MisReservasListado() {
  const router = useRouter();
  // Recogemos el ID de la comunidad de la URL
  const { comunidad_id } = useLocalSearchParams();
  const { misReservas } = useZonasStore();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Mis Reservas</Text>

      {misReservas.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No tienes ninguna reserva activa.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Volver al calendario</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={misReservas}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reservaCard}
              // AHORA SÍ CONSTRUYE LA RUTA PERFECTA CON EL ID DE LA COMUNIDAD Y LA RESERVA
              onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.zonaNombre}>{item.zonaNombre}</Text>
                {item.requiereQR && (
                  <View style={styles.qrBadge}>
                    <Text style={styles.qrBadgeText}>QR Req.</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.fechaHora}>📅 {item.fecha}</Text>
                <Text style={styles.fechaHora}>⏰ {item.hora}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.darkBlue, marginBottom: 24 },
  
  reservaCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: COLORS.grayBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  zonaNombre: { fontSize: 20, fontWeight: 'bold', color: COLORS.primaryBlue },
  qrBadge: { backgroundColor: '#E6F4FA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  qrBadgeText: { color: COLORS.primaryBlue, fontSize: 12, fontWeight: 'bold' },
  cardBody: { flexDirection: 'row', gap: 20 },
  fechaHora: { fontSize: 16, color: COLORS.grayText, fontWeight: '500' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -60 },
  emptyStateText: { fontSize: 18, color: COLORS.grayText, textAlign: 'center', marginBottom: 20 },
  backButton: { backgroundColor: COLORS.primaryBlue, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }
});