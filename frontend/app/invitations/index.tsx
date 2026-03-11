import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building, Check, X, Inbox, ArrowLeft, ShieldCheck, User } from 'lucide-react-native';
import { useInvitationsStore, Invitation } from '../../store/useInvitationStore';

export default function PendingInvitationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const { 
    invitations, 
    isLoading, 
    fetchInvitations, 
    acceptInvitation, 
    rejectInvitation 
  } = useInvitationsStore();

  // Separamos los estados de carga para que no se pise el Aceptar con el Rechazar
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  
  // Estados para controlar el modal de rechazo
  const [isRejectModalVisible, setRejectModalVisible] = useState(false);
  const [invitationToReject, setInvitationToReject] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleAccept = async (id: string) => {
    setAcceptingId(id);
    const success = await acceptInvitation(id);
    setAcceptingId(null);
    
    if (success) {
      Alert.alert("¡Éxito!", "Te has unido a la comunidad correctamente. Ya puedes acceder a ella desde el menú lateral.");
    } else {
      Alert.alert("Error", "No se pudo aceptar la invitación. Inténtalo de nuevo más tarde.");
    }
  };

  const handleRejectPress = (id: string) => {
    setInvitationToReject(id);
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!invitationToReject) return;
    
    const id = invitationToReject;
    setRejectModalVisible(false); // Cerramos el modal
    setRejectingId(id); // Ponemos a cargar el botón de rechazar de ese item
    
    await rejectInvitation(id); 
    
    setRejectingId(null);
    setInvitationToReject(null);
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrapper}>
          <Inbox color="#94A3B8" size={48} />
        </View>
        <Text style={styles.emptyTitle}>Sin invitaciones</Text>
        <Text style={styles.emptySubtitle}>No tienes ninguna invitación pendiente a nuevas comunidades en este momento.</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Invitation }) => {
    const isAccepting = acceptingId === item.id;
    const isRejecting = rejectingId === item.id;
    const isAnyProcessing = isAccepting || isRejecting;
    const isRoleAdmin = item.roleId === 1 || item.roleId === 4;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.communityIconWrapper}>
            <Building color="#4F46E5" size={24} />
          </View>
          <View style={styles.communityInfo}>
            <Text style={styles.communityName} numberOfLines={1}>{item.communityName}</Text>
            <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.roleContainer}>
          <Text style={styles.roleLabel}>Rol asignado:</Text>
          <View style={[styles.roleBadge, isRoleAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
            {isRoleAdmin ? <ShieldCheck color="#4F46E5" size={14} /> : <User color="#059669" size={14} />}
            <Text style={[styles.roleText, isRoleAdmin ? styles.roleTextAdmin : styles.roleTextUser]}>
              {item.roleName}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.btn, styles.btnReject, isAnyProcessing && styles.btnDisabled]} 
            onPress={() => { handleRejectPress(item.id); }}
            disabled={isAnyProcessing}
          >
            {isRejecting ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <X color="#EF4444" size={20} />
                <Text style={styles.btnRejectText}>Rechazar</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btn, styles.btnAccept, isAnyProcessing && styles.btnDisabled]} 
            onPress={() => { handleAccept(item.id); }}
            disabled={isAnyProcessing}
          >
            {isAccepting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Check color="#ffffff" size={20} />
                <Text style={styles.btnAcceptText}>Aceptar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { router.back(); }} hitSlop={10} style={styles.backButton}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Invitaciones</Text>
          <Text style={styles.headerSubtitle}>{invitations.length} pendientes</Text>
        </View>
      </View>

      {isLoading && invitations.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN */}
      <Modal
        visible={isRejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setRejectModalVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rechazar invitación</Text>
            <Text style={styles.modalText}>¿Estás seguro de que deseas rechazar esta invitación?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => { setRejectModalVisible(false); }}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnReject]} 
                onPress={confirmReject}
              >
                <Text style={styles.modalBtnRejectText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 65, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    backgroundColor: '#ffffff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitleContainer: { 
    flex: 1 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#0F172A' 
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#64748B' 
  },
  listContent: { 
    padding: 20,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 14,
    color: '#64748B',
    marginRight: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: '#EEF2FF',
  },
  roleBadgeUser: {
    backgroundColor: '#D1FAE5',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  roleTextAdmin: {
    color: '#4F46E5',
  },
  roleTextUser: {
    color: '#059669',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  btnReject: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnRejectText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  btnAccept: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnAcceptText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnReject: {
    backgroundColor: '#EF4444',
  },
  modalBtnCancelText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnRejectText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});