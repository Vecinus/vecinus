import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter, type Href, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { useCommunityStore } from "../store/useCommunityStore";
import { useMembersStore } from "../store/useMembersStore";
import { usePropertyStore } from "../store/usePropertyStore";

// Tipado para los iconos
type IconName = keyof typeof Ionicons.glyphMap;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface MenuItemType {
  name: string;
  icon: IconName | MaterialIconName;
  library?: "MaterialCommunityIcons";
  route?: string;
  isGlobal?: boolean;
  absolute?: boolean;
  requiresAdmin?: boolean;
  enabled?: boolean;
}

export default function SidebarMenu(props: DrawerContentComponentProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    activeCommunityId,
    activeCommunityName,
    activeCommunityRole,
    communities,
    isLoading,
    setActiveCommunity,
    fetchCommunities,
  } = useCommunityStore();

  const { isAuthenticated } = useAuthStore();
  const { fetchMembers } = useMembersStore();
  const { fetchAvailableProperties } = usePropertyStore();
  const [activeItem, setActiveItem] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isAdmin = activeCommunityRole === 1 || activeCommunityRole === 4;

  useEffect(() => {
    if (isAuthenticated) {
      fetchCommunities();
    }
  }, [isAuthenticated, fetchCommunities]);

  useEffect(() => {
    if (isAuthenticated && activeCommunityId) {
      fetchMembers(activeCommunityId);
      fetchAvailableProperties(activeCommunityId);
    }
  }, [
    activeCommunityId,
    isAuthenticated,
    fetchMembers,
    fetchAvailableProperties,
  ]);

  const menuItems: MenuItemType[] = isAuthenticated
    ? [
        {
          name: "Chat",
          icon: "chatbubble-outline" as IconName,
          enabled: false,
        },
        {
          name: "Avisos",
          icon: "notifications-outline" as IconName,
          enabled: false,
        },
        {
          name: "Tablón",
          icon: "megaphone-outline" as IconName,
          enabled: false,
        },
        {
          name: "Invitaciones",
          icon: "mail-unread-outline" as IconName,
          route: "invitations",
          isGlobal: true,
          enabled: true,
        },
        {
          name: "Asistente IA",
          icon: "robot-outline" as MaterialIconName,
          library: "MaterialCommunityIcons",
          route: "chatbot",
          enabled: true,
        },
        {
          name: "Reservas",
          icon: "calendar-outline" as IconName,
          route: "reservas",
          enabled: true,
        },
        {
          name: "Votaciones",
          icon: "checkbox-outline" as IconName,
          enabled: false,
        },
        {
          name: "Incidencias",
          icon: "warning-outline" as IconName,
          enabled: false,
        },
        {
          name: "Actas",
          icon: "document-text-outline" as IconName,
          route: "actas",
          enabled: true,
        },
        {
          name: "Economía",
          icon: "wallet-outline" as IconName,
          enabled: false,
        },
        {
          name: "Comunidades",
          icon: "business-outline" as IconName,
          route: "admin",
          enabled: true,
          requiresAdmin: true,
        },
        {
          name: "Administración",
          icon: "settings-outline" as IconName,
          enabled: false,
        },
        {
          name: "Cerrar Sesión",
          icon: "log-out-outline" as IconName,
          route: "/auth/logout",
          isGlobal: true,
        },
      ]
    : [
        {
          name: "Iniciar Sesión",
          icon: "log-in-outline" as IconName,
          route: "/auth/login",
          isGlobal: true,
        },
      ];
  const visibleMenuItems = menuItems.filter(
    (item) => item.enabled !== false && (!item.requiresAdmin || isAdmin),
  );

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
        </View>
      </View>

      {isAuthenticated && (
        <TouchableOpacity
          style={[
            styles.communitySelector,
            isDropdownOpen && styles.communitySelectorOpen,
          ]}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#E5E7EB" size="small" />
          ) : (
            <Text style={styles.communityText}>
              {activeCommunityName || "Cargando..."}
            </Text>
          )}
          <Ionicons
            name={isDropdownOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color="#9CA3AF"
          />
        </TouchableOpacity>
      )}

      {isAuthenticated && isDropdownOpen && communities.length > 0 && (
        <View style={styles.dropdownList}>
          {communities.map((community) => (
            <TouchableOpacity
              key={community.id}
              style={styles.dropdownItem}
              onPress={() => {
                setActiveCommunity(
                  community.id,
                  community.name,
                  community.address,
                  community.role,
                );
                setIsDropdownOpen(false);
                if (pathname.startsWith("/comunities/")) {
                  const pathParts = pathname.split("/");
                  if (pathParts.length > 2) {
                    pathParts[2] = community.id.toString();
                    const newPath = pathParts.join("/");

                    props.navigation.closeDrawer();
                    router.replace(newPath as Href);
                  }
                } else {
                  props.navigation.closeDrawer();
                  router.replace(`/comunities/${community.id}/admin` as Href);
                }
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  activeCommunityId === community.id &&
                    styles.dropdownItemTextActive,
                ]}
              >
                {community.name}
              </Text>
              {activeCommunityId === community.id && (
                <Ionicons name="checkmark" size={16} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.navLabel}>Navegación</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleMenuItems.map((item) => {
          const isActive = activeItem === item.name;

          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => {
                setActiveItem(item.name);

                // 4. LÓGICA DE NAVEGACIÓN DINÁMICA
                if (item.route) {
                  if (item.isGlobal) {
                    props.navigation.closeDrawer();
                    router.push(item.route as Href);
                    return;
                  }

                  if (!activeCommunityId && !item.absolute) {
                    alert("Por favor, selecciona una comunidad primero.");
                    return;
                  }

                  props.navigation.closeDrawer();

                  const targetPath = item.absolute
                    ? `/${item.route}`
                    : `/comunities/${activeCommunityId}/${item.route}`;

                  router.push(targetPath as Href);
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
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  subtitle: { color: "#9CA3AF", fontSize: 14 },
  communitySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#161F33",
    borderRadius: 8,
    marginBottom: 24,
  },
  communitySelectorOpen: {
    marginBottom: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  communityText: { color: "#E5E7EB", fontSize: 14, fontWeight: "500" },
  dropdownList: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: 24,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemText: { color: "#9CA3AF", fontSize: 14 },
  dropdownItemTextActive: { color: "#3B82F6", fontWeight: "bold" },
  navLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scrollContent: { paddingBottom: 30 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  menuItemActive: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  menuItemText: { color: "#D1D5DB", marginLeft: 16, fontSize: 15 },
  menuItemTextActive: { color: "#FFFFFF", fontWeight: "bold" },
});
