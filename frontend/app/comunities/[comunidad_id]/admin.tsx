import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import {   Menu, Trash2, UserPlus, Users, Settings, Building, ShieldCheck, Key, User, Crown, Briefcase} from 'lucide-react-native';
import { useMembersStore, Member } from '../../../store/useMembersStore'; 
import { useCommunityStore } from '../../../store/useCommunityStore';

const getRoleConfig = (roleId: number) => {
  switch (roleId) {
    case 1: return { icon: ShieldCheck, color: '#4F46E5', bg: '#EEF2FF' }; 
    case 4: return { icon: Crown,       color: '#D97706', bg: '#FEF3C7' }; 
    case 2: return { icon: Key,         color: '#059669', bg: '#D1FAE5' }; 
    case 3: return { icon: User,        color: '#3B82F6', bg: '#DBEAFE' }; 
    case 5: return { icon: Briefcase,   color: '#64748B', bg: '#F1F5F9' }; 
    default:return { icon: User,        color: '#94A3B8', bg: '#F8FAFC' }; 
  }
};

export default function CommunityAdminScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { comunidad_id } = useLocalSearchParams();
  
  const { activeCommunityName, activeCommunityAddress } = useCommunityStore();
  const { deleteMember, isLoading, members, fetchMembers } = useMembersStore();

  useEffect(() => {
    if (comunidad_id) {
      fetchMembers(comunidad_id as string);
    }
  }, [comunidad_id]);

  const handleRemoveMember = (membershipId: string, name: string) => {
    Alert.alert(
      "Eliminar Miembro",
      `¿Estás seguro de que deseas eliminar a ${name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            const success = await deleteMember(membershipId);
            if (success) Alert.alert("Éxito", "Usuario eliminado.");
            else Alert.alert("Error", "No se pudo eliminar al usuario.");
          }
        }
      ]
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const { icon: RoleIcon, color: roleColor, bg: roleBg } = getRoleConfig(item.roleId);

    return (
      <View style={styles.memberCard}>
        <View style={[styles.iconAvatar, { backgroundColor: roleBg }]}>
          <RoleIcon color={roleColor} size={24} />
        </View>
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={[styles.memberRole, { color: roleColor, fontWeight: item.roleId === 1 || item.roleId === 4 ? '600' : '400' }]}>
              {item.roleName}
            </Text>
          </View>
        </View>
        
        {item.roleId !== 1 && item.roleId !== 4 && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleRemoveMember(item.id, item.name)}
            disabled={isLoading}
          >
            <Trash2 color="#EF4444" size={20} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} hitSlop={10}>
          <Menu color="#0F172A" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Administración</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Gestión de comunidad</Text>
        </View>
        <TouchableOpacity hitSlop={10}>
          <Settings color="#4F46E5" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.communityCard}>
        <View style={styles.communityIconWrapper}>
          <Building color="#4F46E5" size={28} />
        </View>
        <View style={styles.communityTextWrapper}>
          <Text style={styles.communityName}>{activeCommunityName || 'Cargando...'}</Text>
          <Text style={styles.communityAddress}>{activeCommunityAddress || `ID: ${comunidad_id}`}</Text>
        </View>
      </View>
      
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.listHeaderTitleRow}>
              <Users color="#0F172A" size={24} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Directorio de Vecinos</Text>
            </View>
            <Text style={styles.sectionSubtitle}>{members?.length || 0} miembros en total</Text>
          </View>
        }
      />

      {/* BOTÓN INVITAR */}
      <View style={styles.footerContainer}>
        <TouchableOpacity style={styles.inviteButton} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <UserPlus color="#ffffff" size={20} style={styles.inviteIcon} />
              <Text style={styles.inviteButtonText}>Invitar Nuevo Vecino</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    height: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitleContainer: { marginLeft: 16, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 13, color: '#64748B' },
  communityCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    marginHorizontal: 20, marginTop: 20, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  communityIconWrapper: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  communityTextWrapper: { flex: 1 },
  communityName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  communityAddress: { fontSize: 14, color: '#64748B' },
  listContent: { padding: 20, paddingBottom: 100 },
  listHeader: { marginBottom: 20 },
  listHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  sectionSubtitle: { fontSize: 14, color: '#64748B', marginLeft: 32 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1,
    borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  iconAvatar: {
    width: 50, height: 50, borderRadius: 25, 
    alignItems: 'center', justifyContent: 'center'
  },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center' },
  memberRole: { fontSize: 13 },
  deleteButton: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10 },
  footerContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20,
    paddingVertical: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  inviteButton: {
    backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  inviteIcon: { marginRight: 8 },
  inviteButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});