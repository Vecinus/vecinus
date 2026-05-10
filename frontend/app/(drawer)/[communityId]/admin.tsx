import React, { useState } from 'react';
import { View, FlatList, ActivityIndicator, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { MemberCard } from '@/components/community/MemberCard';
import { PendingInvitationCard } from '@/components/community/PendingInvitationCard';
import {
  Building, Users, Clock, ChevronDown, ChevronUp, UserPlus,
  Home, AlertTriangle, CreditCard, ChevronRight
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { communityApi } from '@/api/community';
import { isAdminRole } from '@/utils/community-role';
import {
  useCommunityMembers,
  usePendingInvitations,
  useDeleteMember,
  useInviteMember,
  useAddProperty,
  useAvailableProperties
} from '@/hooks/useCommunityAdmin';

export default function CommunityAdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { communityId: routeCommunityIdRaw } = useLocalSearchParams<{ communityId?: string | string[] }>();

  const { user, activeCommunity, currentRole } = useAuth();
  const routeCommunityId = Array.isArray(routeCommunityIdRaw)
    ? routeCommunityIdRaw[0]
    : routeCommunityIdRaw;
  const isInvalidRouteCommunityId =
    !routeCommunityId ||
    routeCommunityId === 'undefined' ||
    routeCommunityId === 'null' ||
    routeCommunityId === '[communityId]';
  const communityId = !isInvalidRouteCommunityId
    ? routeCommunityId
    : activeCommunity?.id;
  const currentUserId = user?.id;

  const isAdmin = isAdminRole(currentRole);
  const communityAddress = activeCommunity?.address?.trim();

  // --- Estados UI ---
  const [showPending, setShowPending] = useState(false);

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [propertyModalVisible, setPropertyModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState({ id: '', name: '' });

  // --- Estados Formularios ---
  const [email, setEmail] = useState('');
  const [roleToGrant, setRoleToGrant] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [inviteError, setInviteError] = useState('');

  const [propertyNumber, setPropertyNumber] = useState('');
  const [propertyError, setPropertyError] = useState('');

  // --- Queries ---
  const { data: members, isLoading: isLoadingMembers, isError, error: membersError, refetch: refetchMembers } = useCommunityMembers(communityId, isAdmin);
  const { data: pendingInvitations, refetch: refetchInvitations } = usePendingInvitations(communityId, isAdmin);
  const { data: availableProperties, isLoading: isLoadingProperties, refetch: refetchProperties } = useAvailableProperties(communityId, isAdmin);

  const actuallyAvailableProperties = React.useMemo(() => {
    if (!availableProperties) return [];
    if (!pendingInvitations) return availableProperties;

    const lockedPropertyIds = new Set(
      pendingInvitations
        .map(inv => inv.property_id)
        .filter(id => id != null)
    );

    return availableProperties.filter(prop => !lockedPropertyIds.has(prop.id));
  }, [availableProperties, pendingInvitations]);

  useFocusEffect(
    React.useCallback(() => {
      if (communityId) {
        refetchMembers();
        if (isAdmin) {
          refetchInvitations();
          refetchProperties();
        }
      }
    }, [communityId, isAdmin, refetchInvitations, refetchMembers, refetchProperties])
  );

  // --- Mutations ---
  const { mutate: deleteMember, isPending: isDeleting } = useDeleteMember(communityId);
  const { mutate: inviteMember, isPending: isInviting } = useInviteMember(communityId);
  const { mutate: addProperty, isPending: isAddingProperty } = useAddProperty(communityId);

  const rolesOptions = communityApi.getRolesOptions();
  const sortedMembers = React.useMemo(() => {
    if (!members) return [];

    return [...members].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.roleId - b.roleId;
    });
  }, [members, currentUserId]);

  React.useEffect(() => {
    if (activeCommunity?.id && String(activeCommunity.id) !== String(routeCommunityId)) {
      router.replace({
        pathname: '/[communityId]/admin',
        params: { communityId: activeCommunity.id },
      });
    }
  }, [routeCommunityId, activeCommunity?.id, router]);

  React.useEffect(() => {
    if (communityId && !isAdmin) {
      router.replace('/');
    }
  }, [communityId, isAdmin, router]);

  // --- Handlers ---
  const handleDeleteTrigger = (membershipId: string, name: string) => {
    setMemberToDelete({ id: membershipId, name });
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    deleteMember(memberToDelete.id, {
      onSuccess: () => setDeleteModalVisible(false),
      onError: () => setDeleteModalVisible(false)
    });
  };

  const resetInviteForm = () => {
    setEmail('');
    setRoleToGrant('');
    setPropertyId('');
    setInviteError('');
    setInviteModalVisible(false);
  };

  const handleInviteSubmit = () => {
    setInviteError('');
    if (!email || !roleToGrant) {
      setInviteError('Por favor, indica un correo electrónico y el rol a asignar.');
      return;
    }
    if (roleToGrant !== '5' && !propertyId) {
      setInviteError('Debes asignar una propiedad libre para este rol.');
      return;
    }

    inviteMember(
      { email, roleToGrant: parseInt(roleToGrant, 10), propertyId: propertyId || undefined },
      {
        onSuccess: resetInviteForm,
        onError: (error: unknown) => {
          const err = error as { response?: { data?: { detail?: string } } };
          setInviteError(err?.response?.data?.detail || 'Error al invitar vecino. Comprueba los datos o tu conexión.');
        }
      }
    );
  };

  const handlePropertySubmit = () => {
    setPropertyError('');
    if (!propertyNumber.trim()) {
      setPropertyError('Introduce el identificador. Ej: Portal 4 Bajo B.');
      return;
    }

    addProperty(propertyNumber, {
      onSuccess: () => {
        setPropertyModalVisible(false);
        setPropertyNumber('');
      },
      onError: () => {
        setPropertyError('No se pudo añadir. Tal vez ya exista.');
      }
    });
  };

  // --- RENDER ---
  if (isLoadingMembers) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-4 text-slate-500 font-semibold tracking-wide">Construyendo directorio...</Text>
      </View>
    );
  }

  if (!communityId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-4 text-slate-500 font-semibold tracking-wide">Resolviendo comunidad activa...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="mt-4 text-slate-500 font-semibold tracking-wide">Redirigiendo...</Text>
      </View>
    );
  }

  if (isError || !members) {
    type ErrorShape = { response?: { status?: number; data?: { detail?: string } } };
    const errShape = membersError as ErrorShape;
    const status = errShape?.response?.status;
    const detail = errShape?.response?.data?.detail;
    const message =
      status === 401
        ? 'Tu sesion ha expirado. Cierra sesion y vuelve a entrar para recargar el token.'
        : status === 403
          ? 'No tienes permisos para consultar esta comunidad con tu rol actual.'
          : detail || 'No pudimos conectar con los servidores de tu comunidad. Si estas trabajando en local, asegurate de que `EXPO_PUBLIC_BACKEND_URL` apunte a tu IP local y no a localhost con el tunel.';

    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <View className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full items-center justify-center mb-6">
          <AlertTriangle size={32} color="#ef4444" />
        </View>
        <Text className="text-xl font-bold text-foreground text-center mb-2">Problemas de conexión</Text>
        <Text className="text-slate-500 text-center leading-relaxed">
          {message}
        </Text>
        {status ? (
          <Text className="text-xs text-slate-400 mt-3 text-center">
            Codigo de error: {status}
          </Text>
        ) : null}
        {communityId ? (
          <Text className="text-xs text-slate-400 mt-1 text-center">
            Comunidad: {communityId}
          </Text>
        ) : null}
        {detail ? (
          <Text className="text-xs text-slate-400 mt-1 text-center">
            Detalle backend: {detail}
          </Text>
        ) : null}
        <Text className="text-xs text-slate-400 mt-1 text-center">
          URL backend: {process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }} className="bg-background">

      {/* Banner de la comunidad: compacto para movil */}
      <View className="mx-5 mt-3 mb-4 rounded-2xl overflow-hidden bg-white dark:bg-card/95 shadow-md shadow-slate-200/70 dark:shadow-none border border-slate-100 dark:border-zinc-800">
        <View className="px-4 py-3 flex-row items-center">
          <View className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
            <Building color="#ffffff" size={22} strokeWidth={2.5} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white" numberOfLines={1}>
              {activeCommunity?.name || 'Comunidad'}
            </Text>
            <Text className="text-sm font-medium text-slate-500 dark:text-zinc-300 mt-1" numberOfLines={1}>
              {communityAddress || 'Direccion no disponible'}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            isMe={item.id === currentUserId}
            canDelete={isAdmin}
            onDelete={handleDeleteTrigger}
            isDeleting={isDeleting}
          />
        )}
        ListHeaderComponent={
          <>
            {isAdmin && communityId ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push((`/${communityId}/subscription`) as never)}
                className="mb-5 rounded-2xl border border-border bg-card px-5 py-4 flex-row items-center gap-4 shadow-sm"
              >
                <View className="size-11 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard size={22} color="#4f46e5" strokeWidth={2.5} />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-foreground">Suscripción y pagos</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    Estado del cobro mensual, consumo de actas/chatbot e historial.
                  </Text>
                </View>
                <ChevronRight size={20} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}

            {/* Sección de Invitaciones (Solo visible si eres Admin y hay algo pendiente) */}
            {isAdmin && pendingInvitations && pendingInvitations.length > 0 && (
              <View className="mb-5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/50 overflow-hidden shadow-sm shadow-amber-100/70 dark:shadow-none">
                <TouchableOpacity
                  className="px-5 py-4 flex-row items-center justify-between"
                  onPress={() => setShowPending(!showPending)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Clock size={22} color="#f59e0b" strokeWidth={2.5} />
                    <Text className="text-[15px] font-bold text-amber-600 dark:text-amber-400 ml-3">
                      Invitaciones Activas ({pendingInvitations.length})
                    </Text>
                  </View>
                  {showPending ? <ChevronUp size={22} color="#f59e0b" /> : <ChevronDown size={22} color="#f59e0b" />}
                </TouchableOpacity>

                {showPending && (
                  <View className="px-4 pb-4 pt-1 border-t border-amber-100 dark:border-amber-900/30">
                    {pendingInvitations.map((inv) => (
                      <PendingInvitationCard key={inv.id} invitation={inv} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Cabecera del Directorio */}
            <View className="flex-row items-center justify-between mt-2 mb-5">
              <View className="flex-row items-center">
                <Users className="text-slate-800 dark:text-slate-200" size={26} strokeWidth={2.5} />
                <Text className="text-2xl font-black text-slate-900 dark:text-white ml-3 tracking-tight">Listado de vecinos</Text>
              </View>
              <View className="bg-slate-200 dark:bg-zinc-800 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  {sortedMembers.length} miembros
                </Text>
              </View>
            </View>
          </>
        }
      />

      {/* FOOTER ACTION BUTTONS */}
      {isAdmin && (
        <View className="absolute bottom-0 w-full px-5 py-4 bg-white/90 dark:bg-card/95 border-t border-slate-200/60 dark:border-border/50 backdrop-blur-3xl flex-row gap-4">
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-500 shadow-lg shadow-indigo-200/60 dark:shadow-none h-14 rounded-2xl flex-row items-center"
            onPress={() => setInviteModalVisible(true)}
          >
            <UserPlus size={20} color="#fff" strokeWidth={2.5} className="mr-3" />
            <Text className="text-white font-bold text-[15px]">Invitar Vecino</Text>
          </Button>

          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-500 shadow-lg shadow-emerald-200/60 dark:shadow-none h-14 rounded-2xl flex-row items-center"
            onPress={() => setPropertyModalVisible(true)}
          >
            <Home size={20} color="#fff" strokeWidth={2.5} className="mr-3" />
            <Text className="text-white font-bold text-[15px]">Añadir Propiedad</Text>
          </Button>
        </View>
      )}

      {/* --- MODAL INVITAR VECINO --- */}
      <Modal visible={inviteModalVisible} animationType="fade" transparent onRequestClose={resetInviteForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center bg-black/45 px-6">
          <View className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-700">
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invitar Vecino</Text>
            <Text className="text-sm text-slate-500 dark:text-zinc-300 mb-5">Rellena los datos para enviar la invitación.</Text>

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Correo electrónico</Text>
            <Input
              className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-4 mb-4"
              placeholder="ejemplo@correo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Rol de acceso</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {rolesOptions.map((opt) => {
                const selected = roleToGrant === opt.id.toString();
                return (
                  <TouchableOpacity
                    key={opt.id.toString()}
                    className={`px-3 py-2 rounded-lg border ${selected ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'}`}
                    activeOpacity={0.8}
                    onPress={() => {
                      setRoleToGrant(opt.id.toString());
                      setPropertyId('');
                    }}
                  >
                    <Text className={`font-semibold text-xs ${selected ? 'text-white' : 'text-slate-700 dark:text-zinc-200'}`}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!roleToGrant && roleToGrant !== '5' && (
              <>
                <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Propiedad libre</Text>
                {isLoadingProperties ? (
                  <View className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 items-center justify-center mb-4">
                    <ActivityIndicator color="#6366f1" />
                  </View>
                ) : !actuallyAvailableProperties || actuallyAvailableProperties.length === 0 ? (
                  <View className="rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-3 mb-4">
                    <Text className="text-slate-500 dark:text-zinc-400 text-xs">No quedan propiedades libres</Text>
                  </View>
                ) : (
                  <View className="mb-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                    <ScrollView style={{ maxHeight: 156 }} nestedScrollEnabled showsVerticalScrollIndicator>
                      {actuallyAvailableProperties.map((prop, index) => {
                        const selected = propertyId === prop.id;
                        const isLast = index === actuallyAvailableProperties.length - 1;
                        return (
                          <TouchableOpacity
                            key={prop.id.toString()}
                            className={`px-4 py-3 flex-row items-center justify-between ${!isLast ? 'border-b border-slate-200 dark:border-zinc-800' : ''} ${selected ? 'bg-emerald-600/10 dark:bg-emerald-500/20' : ''}`}
                            activeOpacity={0.7}
                            onPress={() => setPropertyId(prop.id)}
                          >
                            <Text className={`font-semibold text-[15px] ${selected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                              {prop.number}
                            </Text>
                            {selected && (
                              <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {!!inviteError && (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 p-3 mb-4">
                <Text className="text-red-600 dark:text-red-400 font-semibold text-xs">{inviteError}</Text>
              </View>
            )}

            <View className="flex-row gap-3 mt-1">
              <Button variant="outline" className="flex-1 h-12 border-slate-200 dark:border-zinc-700 bg-transparent" onPress={resetInviteForm} disabled={isInviting}>
                <Text className="font-semibold text-slate-700 dark:text-zinc-200">Cancelar</Text>
              </Button>
              <Button className="flex-1 h-12 bg-indigo-600 dark:bg-indigo-500" onPress={handleInviteSubmit} disabled={isInviting}>
                {isInviting ? <ActivityIndicator color="#fff" /> : <Text className="text-white">Enviar</Text>}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL NUEVA PROPIEDAD --- */}
      <Modal visible={propertyModalVisible} animationType="fade" transparent onRequestClose={() => setPropertyModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center bg-black/45 px-6">
          <View className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-700">
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">Añadir Propiedad</Text>
            <Text className="text-sm text-slate-500 dark:text-zinc-300 mb-5">Define un identificador para asignárselo a vecinos más adelante.</Text>

            <Text className="mb-2 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">Identificador</Text>
            <Input
              className="h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-4 mb-2"
              placeholder="Ej. Puerta 4B, Local 1..."
              value={propertyNumber}
              onChangeText={setPropertyNumber}
              autoCapitalize="words"
            />

            {!!propertyError && (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 p-3 mb-4">
                <Text className="text-red-600 dark:text-red-400 font-semibold text-xs">{propertyError}</Text>
              </View>
            )}

            <View className="flex-row gap-3 mt-1">
              <Button variant="outline" className="flex-1 h-12 border-slate-200 dark:border-zinc-700 bg-transparent" onPress={() => setPropertyModalVisible(false)} disabled={isAddingProperty}>
                <Text className="font-semibold text-slate-700 dark:text-zinc-200">Cancelar</Text>
              </Button>
              <Button className="flex-1 h-12 bg-indigo-600 dark:bg-indigo-500" onPress={handlePropertySubmit} disabled={isAddingProperty}>
                {isAddingProperty ? <ActivityIndicator color="#fff" /> : <Text className="text-white">Crear</Text>}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL ELIMINAR --- */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center bg-black/45 px-6">
          <View className="bg-white dark:bg-card rounded-3xl p-6 border border-slate-200 dark:border-border">
            <View className="w-14 h-14 bg-red-50 dark:bg-red-900/25 rounded-2xl items-center justify-center mb-4 self-center">
              <AlertTriangle color="#ef4444" size={28} strokeWidth={2.5} />
            </View>
            <Text className="text-xl font-bold text-slate-900 dark:text-foreground mb-2 text-center">Eliminar Vecino</Text>
            <Text className="text-sm text-slate-500 dark:text-muted-foreground text-center leading-relaxed mb-6">
              ¿Estás seguro de expulsar a <Text className="font-bold text-slate-800 dark:text-foreground">{memberToDelete.name}</Text>? Se le revocará todo el acceso.
            </Text>
            <View className="flex-row gap-3 mt-1">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <Text className="font-semibold text-foreground">Cancelar</Text>
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <ActivityIndicator color="#dc2626" /> : <Text className="font-semibold text-red-600 dark:text-red-400">Expulsar</Text>}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
