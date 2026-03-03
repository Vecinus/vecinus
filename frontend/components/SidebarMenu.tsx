import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
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
  
  // 1. EXTRAEMOS LA LISTA Y EL SETTER (AÑADIDO)
  const { activeCommunityId, activeCommunityName, communities, setActiveCommunity } = useCommunityStore();
  
  // 2. ESTADO PARA ABRIR EL DESPLEGABLE (AÑADIDO)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string>('');

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

      {/* 3. AÑADIMOS EL ONPRESS PARA TOGGLE (MODIFICADO) */}
      <TouchableOpacity 
        style={styles.communitySelector}
        onPress={() => setIsSelectorOpen(!isSelectorOpen)}
      >
        <Text style={styles.communityText}>{activeCommunityName}</Text>
        <Ionicons name={isSelectorOpen ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* 4. RENDERIZAMOS LAS OPCIONES SI ESTÁ ABIERTO (AÑADIDO) */}
      {isSelectorOpen && (
        <View style={styles.dropdownContainer}>
          {communities.map((comunidad) => (
            <TouchableOpacity
              key={comunidad.id}
              style={[styles.dropdownItem, comunidad.id === activeCommunityId && styles.dropdownItemActive]}
              onPress={() => {
                setActiveCommunity(comunidad.id, comunidad.name);
                setIsSelectorOpen(false);
              }}
            >
              <Text style={[styles.dropdownText, comunidad.id === activeCommunityId && styles.dropdownTextActive]}>
                {comunidad.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
                if (item.route) {
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
  // NUEVOS ESTILOS PARA EL DESPLEGABLE
  dropdownContainer: { backgroundColor: '#161F33', borderRadius: 8, marginTop: -20, marginBottom: 20, padding: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
  dropdownItemActive: { backgroundColor: '#1F2937' },
  dropdownText: { color: '#9CA3AF', fontSize: 14 },
  dropdownTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  // RESTO DE ESTILOS IGUALES
  navLabel: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 },
  scrollContent: { paddingBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  menuItemActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.05)' },
  menuItemText: { color: '#D1D5DB', marginLeft: 16, fontSize: 15 },
  menuItemTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
});