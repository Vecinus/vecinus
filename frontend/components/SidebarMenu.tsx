import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useCommunityStore } from '../store/useCommunityStore';
import { loadUserCommunities } from '@/services/communityService';

// Tipado para los iconos
type IconName = keyof typeof Ionicons.glyphMap;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface MenuItemType {
  name: string;
  icon: IconName | MaterialIconName;
  library?: "MaterialCommunityIcons";
  route?: string;
  absolute?: boolean;
}

export default function SidebarMenu(props: DrawerContentComponentProps) {
    const router = useRouter();
    const { 
      activeCommunityId, 
      activeCommunityName, 
      communities, 
      userToken, 
      setActiveCommunity,
    } = useCommunityStore();
    
    const [activeItem, setActiveItem] = useState<string>('');
    const [showCommunityList, setShowCommunityList] = useState(false);

    // --- LÓGICA DE CARGA INICIAL ---
    useEffect(() => {
      // Token de prueba para bypass del login
      const TOKEN_PRUEBA = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjBjOTk0ODE0LTIxOTktNGZlYS1iMmZiLTI3ZmVmOWQ1OTVmOCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FzZ21wbHN3bnRuamt4dHllYnZiLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlOTUyZTQ3Mi02YTIzLTQ2MDYtODE3Yy1lNTJmOTU1ZTUyODciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyNjI3ODMyLCJpYXQiOjE3NzI2MjQyMzIsImVtYWlsIjoicHJ1ZWJhMUBwcnVlYmEuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzI2MjQyMzJ9XSwic2Vzc2lvbl9pZCI6ImUyODMyOGU4LTk4YTEtNGJjMi04MWYyLWY4ZDQzNjFmOTEyOCIsImlzX2Fub255bW91cyI6ZmFsc2V9.Jp1ytkPyvwTwgh-sVjZb5wY8MoiqrTvavRsmDcoCAy66Xq2uzzxnBPTw_x12N1Xvd6leCVn_n2b4KnfBgtLCwg";

      if (communities.length === 0) {
        console.log("!!! SidebarMenu: Cargando comunidades...");
        // Priorizamos el token del store, si no existe usamos el de prueba
        const tokenAUsar = userToken || TOKEN_PRUEBA;
        loadUserCommunities(tokenAUsar);
      }
    }, [userToken, communities.length]);

  const menuItems: MenuItemType[] = [
    { name: "Chat", icon: "chatbubble-outline" as IconName },
    { name: "Avisos", icon: "notifications-outline" as IconName },
    { name: "Tablón", icon: "megaphone-outline" as IconName },
    {
      name: "Asistente IA",
      icon: "robot-outline" as MaterialIconName,
      library: "MaterialCommunityIcons",
      route: "chatbot",
    },
    { name: "Reservas", icon: "calendar-outline" as IconName },
    { name: "Votaciones", icon: "checkbox-outline" as IconName },
    { name: "Incidencias", icon: "warning-outline" as IconName },
    {
      name: "Actas",
      icon: "document-text-outline" as IconName,
      route: "actas/actas", // ruta real del archivo app/actas/actas.tsx
      absolute: true,
    },
    { name: "Economía", icon: "wallet-outline" as IconName },
    { name: "Comunidades", icon: "business-outline" as IconName },
    { name: "Administración", icon: "settings-outline" as IconName },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require("../assets/logos/VecinusLogotipoTransparente.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Vecinus</Text>
          <Text style={styles.subtitle}>Comunidad</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.communitySelector}
        onPress={() => setShowCommunityList(!showCommunityList)}
      >
        <Text style={styles.communityText} numberOfLines={1}>
            {activeCommunityName}
        </Text>
        <Ionicons 
          name={showCommunityList ? "chevron-up" : "chevron-down"} 
          size={18} 
          color="#9CA3AF" 
        />
      </TouchableOpacity>

      {showCommunityList && (
        <View style={styles.dropdownContainer}>
          {communities.map((comm) => (
            <TouchableOpacity
              key={comm.id}
              style={[
                styles.dropdownItem,
                comm.id === activeCommunityId && styles.dropdownItemActive
              ]}
              onPress={() => {
                setActiveCommunity(comm.id, comm.name);
                setShowCommunityList(false);
                router.replace('/(tabs)'); 
                props.navigation.closeDrawer();
              }}
            >
              <Text style={[
                styles.dropdownItemText,
                comm.id === activeCommunityId && styles.dropdownItemTextActive
              ]}>
                {comm.name}
              </Text>
            </TouchableOpacity>
          ))}
          {communities.length === 0 && (
              <Text style={styles.dropdownItemText}>Cargando comunidades...</Text>
          )}
        </View>
      )}

      <Text style={styles.navLabel}>Navegación</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {menuItems.map((item) => {
          const isActive = activeItem === item.name;

          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => {
                setActiveItem(item.name);
                
                if (item.route) {
                  if (!activeCommunityId) {
                    Alert.alert("Atención", "Por favor, selecciona una comunidad primero");
                    return;
                  }
                  router.push(`/comunities/${activeCommunityId}/${item.route}` as any);
                  props.navigation.closeDrawer();
                }
              }}
            >
              {item.library === "MaterialCommunityIcons" ? (
                <MaterialCommunityIcons
                  name={item.icon as MaterialIconName}
                  size={22}
                  color={isActive ? "#FFFFFF" : "#D1D5DB"}
                />
              ) : (
                <Ionicons
                  name={item.icon as IconName}
                  size={22}
                  color={isActive ? "#FFFFFF" : "#D1D5DB"}
                />
              )}
              <Text
                style={[
                  styles.menuItemText,
                  isActive && styles.menuItemTextActive,
                ]}
              >
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
  container: {
    flex: 1,
    backgroundColor: "#0B1221",
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logo: { width: 42, height: 42 },
  headerTextContainer: { marginLeft: 12 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 14 },
  communitySelector: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingVertical: 12, 
      paddingHorizontal: 14, 
      backgroundColor: '#161F33', 
      borderRadius: 8, 
      marginBottom: 24 
  },
  communityText: { color: '#E5E7EB', fontSize: 14, fontWeight: '500', flex: 1 },
  navLabel: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 },
  scrollContent: { paddingBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  menuItemActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.05)' },
  menuItemText: { color: '#D1D5DB', marginLeft: 16, fontSize: 15 },
  menuItemTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  dropdownContainer: {
    backgroundColor: '#161F33',
    borderRadius: 8,
    marginTop: -20,
    marginBottom: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 6,
  },
  dropdownItemText: { color: '#D1D5DB', fontSize: 14 },
  dropdownItemTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
});
