import React, { useState, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, TextInput, Text, Linking } from 'react-native';
import { FlashList } from '@shopify/flash-list';

// Paleta de colores basada en tu logo
const COLORS = {
  primaryBlue: '#0088CC', 
  darkBlue: '#005588',    
  greenCheck: '#88CC00',  
  lightBackground: '#F5F9FF',
  white: '#FFFFFF',
  grayText: '#666666',
  grayBorder: '#E0E0E0',
};

interface Vecino {
  id: string;
  nombre: string;
  edificio: string;
  piso: number;
  puerta: string;
  telefono: string;
  email: string;
}

const VECINOS_MOCK: Vecino[] = [
  // Bloque A
  { id: '1', nombre: 'Juan Pérez', edificio: 'Bloque A', piso: 1, puerta: 'A', telefono: '600111222', email: 'juan.perez@email.com' },
  { id: '2', nombre: 'María López', edificio: 'Bloque A', piso: 1, puerta: 'B', telefono: '611222333', email: 'maria.lopez@email.com' },
  { id: '3', nombre: 'Carlos Ruiz', edificio: 'Bloque A', piso: 1, puerta: 'C', telefono: '622333444', email: 'carlos.ruiz@email.com' },
  { id: '4', nombre: 'Ana Gómez', edificio: 'Bloque A', piso: 2, puerta: 'A', telefono: '633444555', email: 'ana.gomez@email.com' },
  { id: '5', nombre: 'Luis Martínez', edificio: 'Bloque A', piso: 2, puerta: 'B', telefono: '644555666', email: 'luis.martinez@email.com' },
  { id: '6', nombre: 'Elena Díaz', edificio: 'Bloque A', piso: 2, puerta: 'C', telefono: '655666777', email: 'elena.diaz@email.com' },
  { id: '7', nombre: 'Pedro Sánchez', edificio: 'Bloque A', piso: 3, puerta: 'A', telefono: '666777888', email: 'pedro.sanchez@email.com' },
  { id: '8', nombre: 'Laura Fernández', edificio: 'Bloque A', piso: 3, puerta: 'B', telefono: '677888999', email: 'laura.fernandez@email.com' },
  { id: '9', nombre: 'David Moreno', edificio: 'Bloque A', piso: 3, puerta: 'C', telefono: '688999000', email: 'david.moreno@email.com' },
  { id: '10', nombre: 'Marta Jiménez', edificio: 'Bloque A', piso: 4, puerta: 'A', telefono: '699000111', email: 'marta.jimenez@email.com' },
  { id: '11', nombre: 'José Muñoz', edificio: 'Bloque A', piso: 4, puerta: 'B', telefono: '600222333', email: 'jose.munoz@email.com' },
  { id: '12', nombre: 'Carmen Álvarez', edificio: 'Bloque A', piso: 4, puerta: 'C', telefono: '611333444', email: 'carmen.alvarez@email.com' },
  { id: '13', nombre: 'Manuel Romero', edificio: 'Bloque A', piso: 5, puerta: 'A', telefono: '622444555', email: 'manuel.romero@email.com' },
  { id: '14', nombre: 'Lucía Alonso', edificio: 'Bloque A', piso: 5, puerta: 'B', telefono: '633555666', email: 'lucia.alonso@email.com' },
  { id: '15', nombre: 'Javier Gutiérrez', edificio: 'Bloque A', piso: 5, puerta: 'C', telefono: '644666777', email: 'javier.gutierrez@email.com' },
  { id: '16', nombre: 'Isabel Navarro', edificio: 'Bloque A', piso: 6, puerta: 'A', telefono: '655777888', email: 'isabel.navarro@email.com' },
  { id: '17', nombre: 'Francisco Torres', edificio: 'Bloque A', piso: 6, puerta: 'B', telefono: '666888999', email: 'francisco.torres@email.com' },
  { id: '18', nombre: 'Paula Domínguez', edificio: 'Bloque A', piso: 6, puerta: 'C', telefono: '677999000', email: 'paula.dominguez@email.com' },

  // Bloque B (En este bloque usamos números para las puertas)
  { id: '19', nombre: 'Raúl Vázquez', edificio: 'Bloque B', piso: 1, puerta: '1', telefono: '688000111', email: 'raul.vazquez@email.com' },
  { id: '20', nombre: 'Sara Ramos', edificio: 'Bloque B', piso: 1, puerta: '2', telefono: '699111222', email: 'sara.ramos@email.com' },
  { id: '21', nombre: 'Miguel Blanco', edificio: 'Bloque B', piso: 1, puerta: '3', telefono: '600333555', email: 'miguel.blanco@email.com' },
  { id: '22', nombre: 'Rosa Castro', edificio: 'Bloque B', piso: 2, puerta: '1', telefono: '611444666', email: 'rosa.castro@email.com' },
  { id: '23', nombre: 'Ángel Rubio', edificio: 'Bloque B', piso: 2, puerta: '2', telefono: '622555777', email: 'angel.rubio@email.com' },
  { id: '24', nombre: 'Cristina Sanz', edificio: 'Bloque B', piso: 2, puerta: '3', telefono: '633666888', email: 'cristina.sanz@email.com' },
  { id: '25', nombre: 'Pablo Iglesias', edificio: 'Bloque B', piso: 3, puerta: '1', telefono: '644777999', email: 'pablo.iglesias@email.com' },
  { id: '26', nombre: 'Silvia Ortiz', edificio: 'Bloque B', piso: 3, puerta: '2', telefono: '655888000', email: 'silvia.ortiz@email.com' },
  { id: '27', nombre: 'Jorge Marín', edificio: 'Bloque B', piso: 3, puerta: '3', telefono: '666999111', email: 'jorge.marin@email.com' },
  { id: '28', nombre: 'Beatriz Medina', edificio: 'Bloque B', piso: 4, puerta: '1', telefono: '677000222', email: 'beatriz.medina@email.com' },
  { id: '29', nombre: 'Diego Garrido', edificio: 'Bloque B', piso: 4, puerta: '2', telefono: '688111333', email: 'diego.garrido@email.com' },
  { id: '30', nombre: 'Clara Santos', edificio: 'Bloque B', piso: 4, puerta: '3', telefono: '699222444', email: 'clara.santos@email.com' },
  { id: '31', nombre: 'Alberto Cruz', edificio: 'Bloque B', piso: 5, puerta: '1', telefono: '600444555', email: 'alberto.cruz@email.com' },
  { id: '32', nombre: 'Raquel Prieto', edificio: 'Bloque B', piso: 5, puerta: '2', telefono: '611555666', email: 'raquel.prieto@email.com' },
  { id: '33', nombre: 'Víctor Calvo', edificio: 'Bloque B', piso: 5, puerta: '3', telefono: '622666777', email: 'victor.calvo@email.com' },
  { id: '34', nombre: 'Natalia Vega', edificio: 'Bloque B', piso: 6, puerta: '1', telefono: '633777888', email: 'natalia.vega@email.com' },
  { id: '35', nombre: 'Mario Delgado', edificio: 'Bloque B', piso: 6, puerta: '2', telefono: '644888999', email: 'mario.delgado@email.com' },
  { id: '36', nombre: 'Alicia Peña', edificio: 'Bloque B', piso: 6, puerta: '3', telefono: '655999000', email: 'alicia.pena@email.com' },

  // Torre Norte (Edificio más alto, letras D y E)
  { id: '37', nombre: 'Hugo León', edificio: 'Torre Norte', piso: 1, puerta: 'D', telefono: '666111222', email: 'hugo.leon@email.com' },
  { id: '38', nombre: 'Irene Márquez', edificio: 'Torre Norte', piso: 2, puerta: 'E', telefono: '677222333', email: 'irene.marquez@email.com' },
  { id: '39', nombre: 'Marcos Cabrera', edificio: 'Torre Norte', piso: 5, puerta: 'D', telefono: '688333444', email: 'marcos.cabrera@email.com' },
  { id: '40', nombre: 'Andrea Campos', edificio: 'Torre Norte', piso: 8, puerta: 'E', telefono: '699444555', email: 'andrea.campos@email.com' },
  { id: '41', nombre: 'Rubén Carmona', edificio: 'Torre Norte', piso: 10, puerta: 'D', telefono: '600555777', email: 'ruben.carmona@email.com' },
  { id: '42', nombre: 'Julia Vicente', edificio: 'Torre Norte', piso: 12, puerta: 'E', telefono: '611666888', email: 'julia.vicente@email.com' },
  { id: '43', nombre: 'Adrián Mora', edificio: 'Torre Norte', piso: 15, puerta: 'D', telefono: '622777999', email: 'adrian.mora@email.com' },
  { id: '44', nombre: 'Lorena Reyes', edificio: 'Torre Norte', piso: 18, puerta: 'E', telefono: '633888000', email: 'lorena.reyes@email.com' },
  { id: '45', nombre: 'Guillermo Aguilar', edificio: 'Torre Norte', piso: 20, puerta: 'D', telefono: '644999111', email: 'guillermo.aguilar@email.com' },

  // Personal / Zonas Comunes
  { id: '46', nombre: 'Felipe (Conserje)', edificio: 'Zonas Comunes', piso: 0, puerta: 'Recepción', telefono: '655000222', email: 'conserjeria@comunidad.com' },
  { id: '47', nombre: 'Mantenimiento Piscinas', edificio: 'Zonas Comunes', piso: 0, puerta: 'Cuarto Máquinas', telefono: '666111333', email: 'piscinas@mantenimiento.com' },
  { id: '48', nombre: 'Administración Fincas', edificio: 'Zonas Comunes', piso: 0, puerta: 'Oficina', telefono: '900123456', email: 'info@adminfincas.com' },
  { id: '49', nombre: 'Limpieza (Garajes)', edificio: 'Zonas Comunes', piso: -1, puerta: 'Almacén', telefono: '677222444', email: 'limpieza.sotanos@servicios.com' },
  { id: '50', nombre: 'Presidente Comunidad', edificio: 'Bloque A', piso: 4, puerta: 'B', telefono: '688333555', email: 'presidente@comunidad.com' },
];

export default function DirectorioComunidad() {
  const [vecinoSeleccionado, setVecinoSeleccionado] = useState<Vecino | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEdificio, setFiltroEdificio] = useState<string>('Todos');

  // 2. Extraemos los edificios únicos
  const edificiosDisponibles = useMemo(() => {
    const edificios = new Set(VECINOS_MOCK.map(v => v.edificio));
    return ['Todos', ...Array.from(edificios)];
  }, []);

  const vecinosFiltrados = useMemo(() => {
    return VECINOS_MOCK.filter((vecino) => {
      const coincideEdificio = filtroEdificio === 'Todos' || vecino.edificio === filtroEdificio;
      const coincideBusqueda = vecino.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                               vecino.puerta.toLowerCase().includes(busqueda.toLowerCase());
      
      return coincideEdificio && coincideBusqueda;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [busqueda, filtroEdificio]);

  const renderVecino = ({ item }: { item: Vecino }) => (
    <TouchableOpacity 
      style={styles.vecinoCard} 
      onPress={() => setVecinoSeleccionado(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{item.nombre.charAt(0)}</Text>
      </View>
      <View style={styles.vecinoInfo}>
        <Text style={styles.vecinoNombre} numberOfLines={1}>
          {item.nombre}
        </Text>
        <Text style={styles.vecinoUbicacion}>
          {item.edificio} • Piso {item.piso} • Puerta {item.puerta}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Directorio</Text>
        
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o puerta..."
          placeholderTextColor="#999"
          value={busqueda}
          onChangeText={setBusqueda}
        />

        <View style={styles.filtrosContainer}>
          <FlashList
            data={edificiosDisponibles}
            horizontal
            showsHorizontalScrollIndicator={false}
            estimatedItemSize={80}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filtroPill,
                  filtroEdificio === item && styles.filtroPillActive
                ]}
                onPress={() => setFiltroEdificio(item)}
              >
                <Text style={[
                  styles.filtroText,
                  filtroEdificio === item && styles.filtroTextActive
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      <View style={styles.listContainer}>
        <FlashList
          data={vecinosFiltrados}
          renderItem={renderVecino}
          keyExtractor={(item) => item.id}
          estimatedItemSize={82} 
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ color: COLORS.grayText }}>No se encontraron vecinos.</Text>
            </View>
          }
        />
      </View>

      <Modal visible={!!vecinoSeleccionado} transparent={true} animationType="slide" onRequestClose={() => setVecinoSeleccionado(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {vecinoSeleccionado && (
              <>
                <View style={styles.modalHeaderDecor} />
                <Text style={styles.modalNombre}>{vecinoSeleccionado.nombre}</Text>
                
                <View style={styles.badgeUbicacion}>
                  <Text style={styles.modalUbicacionText}>
                    {vecinoSeleccionado.edificio} • Piso {vecinoSeleccionado.piso} - Puerta {vecinoSeleccionado.puerta}
                  </Text>
                </View>

                <View style={styles.accionesContainer}>
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: COLORS.greenCheck }]}
                  >
                    <Text style={styles.actionButtonText}>Escribir Mensaje</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={() => setVecinoSeleccionado(null)}>
                  <Text style={styles.closeButtonText}>Cerrar ficha</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBackground },
  header: { padding: 20, paddingTop: 60, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.grayBorder },
  headerTitle: { marginBottom: 16, fontSize: 28, color: COLORS.darkBlue, fontWeight: 'bold' },
  searchInput: { backgroundColor: COLORS.lightBackground, padding: 14, borderRadius: 12, fontSize: 16, color: COLORS.darkBlue, marginBottom: 16 },
  filtrosContainer: { height: 45, width: '100%' }, 
  filtroPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.lightBackground, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  filtroPillActive: { backgroundColor: COLORS.primaryBlue, borderColor: COLORS.primaryBlue },
  filtroText: { color: COLORS.grayText, fontWeight: '600' },
  filtroTextActive: { color: COLORS.white },
  listContainer: { flex: 1, padding: 16 }, 
  vecinoCard: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0, 136, 204, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.primaryBlue },
  vecinoInfo: { flex: 1 },
  vecinoNombre: { fontSize: 18, color: COLORS.darkBlue, marginBottom: 4, fontWeight: 'bold' },
  vecinoUbicacion: { fontSize: 14, color: COLORS.grayText },
  emptyState: { alignItems: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 30, 50, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 32, minHeight: 350, alignItems: 'center' },
  modalHeaderDecor: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 10, position: 'absolute', top: 12 },
  modalNombre: { marginBottom: 12, fontSize: 26, color: COLORS.darkBlue, fontWeight: 'bold' },
  badgeUbicacion: { backgroundColor: COLORS.lightBackground, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, marginBottom: 32 },
  modalUbicacionText: { color: COLORS.primaryBlue, fontWeight: '600', fontSize: 14 },
  accionesContainer: { width: '100%', gap: 16, marginBottom: 24 },
  actionButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', width: '100%' },
  actionButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.primaryBlue },
  secondaryButtonText: { color: COLORS.primaryBlue, fontSize: 16, fontWeight: 'bold' },
  closeButton: { padding: 12 },
  closeButtonText: { color: COLORS.grayText, fontSize: 15, fontWeight: '600' }
});