import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useZonasStore } from '../../../../store/useZonesStore';

const COLORS = {
  primaryBlue: '#0088CC',
  darkBlue: '#005588',
  white: '#FFFFFF',
  grayText: '#666666',
  grayBorder: '#E0E0E0',
  lightBackground: '#F5F9FF',
  greenCheck: '#88CC00'
};

export default function MisReservasListado() {
  const router = useRouter();
  const { comunidad_id } = useLocalSearchParams();
  
  const { misReservas, misPasesInvitado, zonas, obtenerMisReservas, obtenerMisPasesInvitado, isLoading } = useZonasStore();

  useEffect(() => {
    if (comunidad_id) {
      obtenerMisReservas(comunidad_id as string);
      obtenerMisPasesInvitado(comunidad_id as string);
    }
  }, [comunidad_id]);

  const getZonaInfo = (zonaId: string | number) => {
    return zonas.find(z => String(z.id) === String(zonaId));
  };

  const listadoCombinado = useMemo(() => {
    const reservas = (misReservas || []).map(r => ({ 
      ...r, 
      itemType: 'reserva', 
      dateSort: r.start_at,
      displayDate: r.start_at ? r.start_at.split('T')[0] : 'Sin fecha',
      displayTime: r.start_at ? r.start_at.split('T')[1].substring(0, 5) : ''
    }));
    
    const pases = (misPasesInvitado || []).map(p => ({ 
      ...p, 
      itemType: 'pase', 
      dateSort: p.valid_for_date,
      displayDate: p.valid_for_date || 'Sin fecha',
      displayTime: '' 
    }));
    
    return [...reservas, ...pases].sort((a, b) => {
      const dateA = new Date(a.dateSort || 0).getTime();
      const dateB = new Date(b.dateSort || 0).getTime();
      return dateA - dateB; 
    });
  }, [misReservas, misPasesInvitado]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push(`/comunities/${comunidad_id}/reservas` as any)} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Pases y Reservas</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primaryBlue} />
        </View>
      ) : listadoCombinado.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No tienes ninguna reserva ni pase activo.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Volver al calendario</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listadoCombinado}
          keyExtractor={(item, index) => `${item.itemType}-${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const zona = getZonaInfo(item.space_id);
            const isPase = item.itemType === 'pase';
            
            return (
              <TouchableOpacity
                style={styles.reservaCard}
                onPress={() => router.push(`/comunities/${comunidad_id}/mis-reservas/${item.id}?itemType=${item.itemType}` as any)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.zonaNombre}>{zona ? zona.name : 'Zona Común'}</Text>
                  
                  <View style={[styles.typeBadge, isPase ? styles.typeBadgePase : styles.typeBadgeReserva]}>
                    <Text style={[styles.typeBadgeText, isPase ? styles.typeBadgeTextPase : styles.typeBadgeTextReserva]}>
                      {isPase ? 'Pase Invitado' : 'Reserva'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.fechaHora}>📅 {item.displayDate}</Text>
                  {!isPase && Boolean(item.displayTime) && (
                    <Text style={styles.fechaHora}>⏰ {item.displayTime}</Text>
                  )}
                  
                  {zona?.requires_qr && (
                     <Text style={styles.qrIconText}>📲 QR Req.</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground, padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backIcon: { marginRight: 15, padding: 5 },
  backIconText: { fontSize: 28, color: COLORS.darkBlue, fontWeight: 'bold' },
  headerTitle: { fontSize: 30, fontWeight: 'bold', color: COLORS.darkBlue },
  
  reservaCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: COLORS.grayBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  zonaNombre: { fontSize: 20, fontWeight: 'bold', color: COLORS.primaryBlue, flex: 1 },
  typeBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 10, 
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  typeBadgeReserva: { backgroundColor: '#E6F4FA' },
  typeBadgePase: { backgroundColor: '#F0F9E6' },
  typeBadgeText: {
    fontSize: 12, 
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  typeBadgeTextReserva: { color: COLORS.primaryBlue },
  typeBadgeTextPase: { color: COLORS.greenCheck },

  cardBody: { flexDirection: 'row', gap: 15, alignItems: 'center', flexWrap: 'wrap' },
  fechaHora: { fontSize: 16, color: COLORS.grayText, fontWeight: '500' },
  qrIconText: { fontSize: 14, color: COLORS.darkBlue, fontWeight: 'bold', marginLeft: 'auto' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -60 },
  emptyStateText: { fontSize: 18, color: COLORS.grayText, textAlign: 'center', marginBottom: 20 },
  backButton: { backgroundColor: COLORS.primaryBlue, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  backButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }
});