import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Modal, TextInput, Platform, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Menu, Trash2, UserPlus, Users, Settings, Building, ShieldCheck, Key, User, Crown, Briefcase, Mail, Home, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

import { useMembersStore, Member } from '../../../store/useMembersStore'; 
import { useCommunityStore } from '../../../store/useCommunityStore';
import { usePropertyStore, Property } from '@/store/usePropertyStore'; 

const getRoleConfig = (roleId: number) => {
  switch (roleId) {
    case 1: return { icon: ShieldCheck, color: '#4F46E5', bg: '#EEF2FF', name: 'Administrador' }; 
    case 4: return { icon: Crown,       color: '#D97706', bg: '#FEF3C7', name: 'Presidente' }; 
    case 2: return { icon: Key,         color: '#059669', bg: '#D1FAE5', name: 'Propietario' }; 
    case 3: return { icon: User,        color: '#3B82F6', bg: '#DBEAFE', name: 'Inquilino' }; 
    case 5: return { icon: Briefcase,   color: '#64748B', bg: '#F1F5F9', name: 'Empleado' }; 
    default:return { icon: User,        color: '#94A3B8', bg: '#F8FAFC', name: 'Desconocido' }; 
  }
};

export default function CommunityAdminScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { comunidad_id } = useLocalSearchParams();
  
  const { activeCommunityName, activeCommunityAddress, activeCommunityRole, currentUserId } = useCommunityStore() as any;
  const { deleteMember, isLoading, members, pendingInvitations, fetchMembers, fetchPendingInvitations, inviteByAdmin, roles } = useMembersStore();
  const { availableProperties, fetchAvailableProperties } = usePropertyStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState({ id: '', name: '' });
  
  // Estados del formulario de invitación
  const [email, setEmail] = useState('');
  const [roleToGrant, setRoleToGrant] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null); // <-- NUEVO ESTADO PARA EL ERROR
  
  const [showPending, setShowPending] = useState(false);

  const isCurrentUserAdmin = activeCommunityRole === 1 || activeCommunityRole === 4;

  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.roleId - b.roleId;
    });
  }, [members, currentUserId]);

  const openInviteModal = () => {
    fetchAvailableProperties(comunidad_id as string);
    setInviteError(null); // Limpiamos errores previos al abrir
    setModalVisible(true);
  };

  const closeInviteModal = () => {
    setModalVisible(false);
    setInviteError(null);
    setEmail('');
    setRoleToGrant('');
    setPropertyId('');
  };

  useEffect(() => {
    if (comunidad_id) {
      fetchMembers(comunidad_id as string);
      if (isCurrentUserAdmin) {
        fetchPendingInvitations(comunidad_id as string);
      }
    }
  }, [comunidad_id, isCurrentUserAdmin]);

  const handleRemoveMemberClick = (membershipId: string, name: string) => {
    if (!membershipId) return;
    setMemberToDelete({ id: membershipId, name });
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    setDeleteModalVisible(false);
    await deleteMember(memberToDelete.id);
  };

  const handleInvite = async () => {
    setInviteError(null); // Reiniciamos el error
    
    // Validación básica en el frontend
    if (!email || !roleToGrant || !comunidad_id || (roleToGrant !== "5" && !propertyId)) {
      setInviteError("Por favor, completa todos los campos obligatorios.");
      return;
    }
    
    const success = await inviteByAdmin(email, roleToGrant, comunidad_id as string, propertyId);
    
    if (success) {
      closeInviteModal();
      fetchMembers(comunidad_id as string);
      fetchPendingInvitations(comunidad_id as string); 
    } else {
      // Capturamos el error del backend (como el de duplicidad) y lo mostramos en la UI
      const errorMsg = useMembersStore.getState().error;
      setInviteError(errorMsg || "Error al enviar la invitación. Inténtalo de nuevo.");
    }
  };

  const togglePendingSection = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPending(!showPending);
  };

  const renderMember = ({ item }: { item: Member }) => {
    const { icon: RoleIcon, color: roleColor, bg: roleBg } = getRoleConfig(item.roleId);
    const isMe = item.id === currentUserId;

    return (
      <View style={[styles.memberCard, isMe && styles.currentUserCard]}>
        <View style={[styles.iconAvatar, { backgroundColor: roleBg }]}>
          <RoleIcon color={roleColor} size={24} />
        </View>
        
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, isMe && styles.currentUserName]}>
            {item.name} {isMe ? '(Tú)' : ''}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={[styles.memberRole, { color: roleColor, fontWeight: item.roleId === 1 || item.roleId === 4 ? '600' : '400' }]}>
              {item.roleName}
            </Text>
          </View>
        </View>
        
        {isCurrentUserAdmin && !isMe && item.roleId !== 1 && item.roleId !== 4 && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => handleRemoveMemberClick(item.membershipId, item.name)}
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
          <Text style={styles.headerTitle}>Comunidades</Text>
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
        data={sortedMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {isCurrentUserAdmin && pendingInvitations.length > 0 && (
              <View style={styles.pendingSection}>
                <TouchableOpacity style={styles.pendingHeader} onPress={togglePendingSection}>
                  <View style={styles.pendingHeaderLeft}>
                    <Clock color="#D97706" size={20} />
                    <Text style={styles.pendingTitle}>Invitaciones Pendientes ({pendingInvitations.length})</Text>
                  </View>
                  {showPending ? <ChevronUp color="#64748B" size={20} /> : <ChevronDown color="#64748B" size={20} />}
                </TouchableOpacity>

                {showPending && (
                  <View style={styles.pendingList}>
                    {pendingInvitations.map((inv) => {
                      const roleConfig = getRoleConfig(inv.role_to_grant);
                      const RoleIcon = roleConfig.icon;
                      return (
                        <View key={inv.id} style={styles.pendingCard}>
                          <View style={[styles.iconAvatar, { backgroundColor: '#F1F5F9', width: 40, height: 40 }]}>
                            <Mail color="#64748B" size={18} />
                          </View>
                          <View style={styles.memberInfo}>
                            <Text style={styles.pendingEmail} numberOfLines={1}>{inv.target_email}</Text>
                            <View style={styles.pendingRoleRow}>
                              <RoleIcon color={roleConfig.color} size={12} style={{marginRight: 4}} />
                              <Text style={[styles.memberRole, { color: roleConfig.color, fontSize: 12 }]}>
                                {roleConfig.name}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.pendingStatusBadge}>
                            <Text style={styles.pendingStatusText}>Pendiente</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={styles.listHeader}>
              <View style={styles.listHeaderTitleRow}>
                <Users color="#0F172A" size={24} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Directorio de Vecinos</Text>
              </View>
              <Text style={styles.sectionSubtitle}>{members?.length || 0} miembros en total</Text>
            </View>
          </>
        }
      />

      <Modal visible={modalVisible} animationType="fade" transparent={true} onRequestClose={closeInviteModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrapper}>
                <UserPlus color="#4F46E5" size={28} />
              </View>
              <Text style={styles.modalTitle}>Invitar Nuevo Vecino</Text>
              <Text style={styles.modalSubtitle}>Enviaremos un correo para que se una a la comunidad.</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={[styles.inputContainer, inviteError ? styles.inputContainerError : null]}>
                <Mail color={inviteError ? "#EF4444" : "#94A3B8"} size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (inviteError) setInviteError(null); // Limpiar error al escribir
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rol a asignar</Text>
              <View style={styles.inputContainer}>
                <ShieldCheck color="#94A3B8" size={20} style={styles.inputIcon} />
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={roleToGrant}
                    onValueChange={(itemValue) => {
                      setRoleToGrant(itemValue);
                      if (inviteError) setInviteError(null);
                    }}
                    style={styles.picker}
                    mode="dropdown"
                    dropdownIconColor="#4F46E5"
                  >
                    <Picker.Item label="Selecciona un rol..." value="" color="#94A3B8" />
                    {Array.from(roles().entries()).map(([roleId, roleName]) => (
                      <Picker.Item 
                        key={roleId} 
                        label={roleName} 
                        value={roleId.toString()} 
                        color="#1E293B" 
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            
            {["2","3","4"].includes(roleToGrant) &&
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Propiedad a asignar</Text>
              <View style={styles.inputContainer}>
                <Home color="#94A3B8" size={20} style={styles.inputIcon} />
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={propertyId}
                    onValueChange={(itemValue) => {
                      setPropertyId(itemValue);
                      if (inviteError) setInviteError(null);
                    }}
                    style={styles.picker}
                    mode="dropdown"
                    dropdownIconColor="#4F46E5"
                  >
                    <Picker.Item label="Selecciona una propiedad..." value="" color="#94A3B8" />
                    {availableProperties.map((prop: Property) => (
                      <Picker.Item key={prop.id} label={prop.number} value={prop.id} color="#1E293B" />
                    ))}
                  </Picker>
                </View>
                {Platform.OS === 'ios' && (
                  <ChevronDown color="#94A3B8" size={20} style={styles.iosPickerIcon} />
                )}
              </View>
            </View>
            }

            {/* MOSTRAR EL MENSAJE DE ERROR EN LA UI */}
            {inviteError && (
              <View style={styles.errorContainer}>
                <AlertTriangle color="#EF4444" size={16} />
                <Text style={styles.errorText}>{inviteError}</Text>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeInviteModal}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, isLoading && { opacity: 0.7 }]} 
                onPress={handleInvite}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar Invitación</Text>
                )}
              </TouchableOpacity>
            </View>
            
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrapper, styles.dangerIconWrapper]}>
                <AlertTriangle color="#EF4444" size={32} />
              </View>
              <Text style={styles.modalTitle}>Eliminar Miembro</Text>
              <Text style={styles.modalSubtitle}>
                ¿Estás seguro de que deseas eliminar a {memberToDelete.name}? Esta acción no se puede deshacer.
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, styles.dangerButton]} onPress={executeDelete}>
                <Text style={styles.submitButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
            
          </View>
        </View>
      </Modal>

      {isCurrentUserAdmin && (
        <View style={styles.footerContainer}>
          <TouchableOpacity 
            style={styles.inviteButton} 
            disabled={isLoading}
            onPress={openInviteModal} 
          >
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
      )}
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
  
  pendingSection: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    overflow: 'hidden',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFBEB',
  },
  pendingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D97706',
    marginLeft: 10,
  },
  pendingList: {
    padding: 12,
    paddingTop: 4,
    backgroundColor: '#FFFBEB',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  pendingEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  pendingRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingStatusBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },

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
  currentUserCard: {
    borderColor: '#4F46E5',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
  },
  iconAvatar: {
    width: 50, height: 50, borderRadius: 25, 
    alignItems: 'center', justifyContent: 'center'
  },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  currentUserName: { color: '#4F46E5', fontWeight: '700' },
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

  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    backgroundColor: 'rgba(15, 23, 42, 0.6)', 
    padding: 20 
  },
  modalContent: { 
    backgroundColor: 'white', 
    padding: 24, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10 
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dangerIconWrapper: {
    backgroundColor: '#FEF2F2',
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#0F172A', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56, 
  },
  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: { 
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    height: '100%',
  },
  pickerWrapper: {
    flex: 1,
    justifyContent: 'center',
    height: '100%',
    marginLeft: -10,
  },
  picker: {
    width: '100%',
    color: '#1E293B',
  },
  iosPickerIcon: {
    position: 'absolute',
    right: 14,
  },
  // ESTILOS DEL MENSAJE DE ERROR
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    marginTop: 8
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 14,
    marginRight: 8,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 16
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 14,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16
  }
});