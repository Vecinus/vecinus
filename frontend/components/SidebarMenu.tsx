// components/SidebarMenu.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useCommunityStore } from '../store/useCommunityStore';

type IconName = keyof typeof Ionicons.glyphMap;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface MenuItemType {
  name: string;
  icon: IconName | MaterialIconName;
  library?: 'MaterialCommunityIcons';
  route?: string; 
}

export default function SidebarMenu(props: DrawerContentComponentProps) {
  const router = useRouter();
  
  // Extraemos todo lo necesario del Store
  const { 
    activeCommunityId, 
    activeCommunityName, 
    communities,
    isLoading,
    loadCommunities,
    setActiveCommunity 
  } = useCommunityStore();
  
  const [activeItem, setActiveItem] = useState<string>('');
  const [isDropdownVisible, setDropdownVisible] = useState(false);

  // Intentamos cargar las comunidades al abrir el menú
  useEffect(() => {
    loadCommunities();
  }, []);

  const menuItems: MenuItemType[] = [
    { name: 'Chat', icon: 'chatbubble-outline' as IconName },
    { name: 'Avisos', icon: 'notifications-outline' as IconName },
    { name: 'Tablón', icon: 'megaphone-outline' as IconName },
    { name: 'Asistente IA', icon: 'robot-outline' as MaterialIconName, library: 'MaterialCommunityIcons', route: 'chatbot' },
    { name: 'Reservas', icon: 'calendar-outline' as IconName },
    { name: 'Votaciones', icon: 'checkbox-outline' as IconName },
    { name: 'Incidencias', icon: 'warning-outline' as IconName },
    { name: 'Actas', icon: 'document-text-outline' as IconName },
    { name: 'Economía', icon: 'wallet-outline' as IconName },
    { name: 'Comunidades', icon: 'business-outline' as IconName },
    { name: 'Administración', icon: 'settings-outline' as IconName },
  ];

  return (
    <View style={styles.container}>
      
      {/* HEADER CON LOGO */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/logos/VecinusLogotipoTransparente.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Vecinus</Text>
          <Text style={styles.subtitle}>Comunidad</Text>
        </View>
      </View>

      {/* SELECTOR DE COMUNIDAD */}
      <TouchableOpacity 
        style={styles.communitySelector}
        onPress={() => { if (communities.length > 0) setDropdownVisible(true); }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#9CA3AF" />
        ) : (
          <>
            <Text style={[
              styles.communityText, 
              activeCommunityName === 'Error de conexión.' && { color: '#EF4444' }
            ]}>
              {activeCommunityName}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </>
        )}
      </TouchableOpacity>

      {/* MODAL DESPLEGABLE (JSX restaurado) */}
      <Modal visible={isDropdownVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownTitle}>Selecciona una comunidad</Text>
            <FlatList 
              data={communities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.dropdownItem, 
                    item.id === activeCommunityId && styles.dropdownItemActive
                  ]}
                  onPress={() => {
                    setActiveCommunity(item.id, item.name);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    item.id === activeCommunityId && styles.dropdownItemTextActive
                  ]}>
                    {item.name}
                  </Text>
                  {item.id === activeCommunityId && (
                    <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.navLabel}>Navegación</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {menuItems.map((item) => {
          const isActive = activeItem === item.name;
          
          return (
            <TouchableOpacity 
              key={item.name} 
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => {
                setActiveItem(item.name);
                
                // Navegación dinámica usando el ID real de la comunidad
                if (item.route && activeCommunityId) {
                  router.push(`/comunities/${activeCommunityId}/${item.route}` as any);
                  props.navigation.closeDrawer();
                }
              }}
            >
              {item.library === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons 
                  name={item.icon as MaterialIconName} 
                  size={22} 
                  color={isActive ? '#FFFFFF' : '#D1D5DB'} 
                />
              ) : (
                <Ionicons 
                  name={item.icon as IconName} 
                  size={22} 
                  color={isActive ? '#FFFFFF' : '#D1D5DB'} 
                />
              )}
              <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1221', paddingTop: 50, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logo: { width: 42, height: 42 },
  headerTextContainer: { marginLeft: 12 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  subtitle: { color: '#9CA3AF', fontSize: 14 },
  communitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#161F33', borderRadius: 8, marginBottom: 24 },
  communityText: { color: '#E5E7EB', fontSize: 14, fontWeight: '500' },
  navLabel: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 },
  scrollContent: { paddingBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  menuItemActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.05)' },
  menuItemText: { color: '#D1D5DB', marginLeft: 16, fontSize: 15 },
  menuItemTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  
  // ESTILOS DEL MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dropdownContainer: { width: '100%', backgroundColor: '#161F33', borderRadius: 12, padding: 16, maxHeight: '50%', borderWidth: 1, borderColor: '#374151' },
  dropdownTitle: { color: '#9CA3AF', fontSize: 12, fontWeight: 'bold', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  dropdownItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0 },
  dropdownItemText: { color: '#D1D5DB', fontSize: 16 },
  dropdownItemTextActive: { color: '#3B82F6', fontWeight: 'bold' },
});