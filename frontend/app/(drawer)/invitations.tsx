import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Building, Check, Inbox, ShieldCheck, User, X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { UserInvitation } from '@/api/community';
import { useMyInvitations, useAcceptInvitation, useRejectInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/utils/community-role';

const SCREEN_OPTIONS = {
  title: 'Invitaciones',
};

const getRoleBadge = (roleId: number) => {
  const adminRole = isAdminRole(roleId);

  if (adminRole) {
    return {
      icon: ShieldCheck,
      badgeClassName: 'bg-indigo-100 dark:bg-indigo-900/30',
      textClassName: 'text-indigo-700 dark:text-indigo-300',
    };
  }

  return {
    icon: User,
    badgeClassName: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClassName: 'text-emerald-700 dark:text-emerald-300',
  };
};

export default function InvitationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshUserContext, logoutContext } = useAuth();

  const { data: invitations = [], isLoading, isError, error, refetch } = useMyInvitations();
  
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [invitationToReject, setInvitationToReject] = useState<string | null>(null);

  const handleSessionExpired = async () => {
    await logoutContext();
    router.replace('/(auth)/sign-in');
  };

  const handleAccept = async (invitationId: string) => {
    try {
      setAcceptingId(invitationId);
      await acceptInvitation.mutateAsync(invitationId);
      await refreshUserContext();
      Alert.alert('Invitacion aceptada', 'Te has unido a la comunidad correctamente.');
    } catch (error: any) {
      if (error?.response?.status === 401) {
        Alert.alert('Sesion expirada', 'Vuelve a iniciar sesion para continuar.');
        await handleSessionExpired();
        return;
      }
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo aceptar la invitacion.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async () => {
    if (!invitationToReject) return;

    try {
      setRejectingId(invitationToReject);
      setInvitationToReject(null);
      await rejectInvitation.mutateAsync(invitationToReject);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        Alert.alert('Sesion expirada', 'Vuelve a iniciar sesion para continuar.');
        await handleSessionExpired();
        return;
      }
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo rechazar la invitacion.');
    } finally {
      setRejectingId(null);
    }
  };

  const renderItem = ({ item }: { item: UserInvitation }) => {
    const isAccepting = acceptingId === item.id;
    const isRejecting = rejectingId === item.id;
    const isProcessing = isAccepting || isRejecting;
    const roleBadge = getRoleBadge(item.roleId);
    const RoleIcon = roleBadge.icon;

    return (
      <View className="bg-card border border-border rounded-2xl p-4 mb-4">
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center mr-3">
            <Building size={22} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {item.communityName}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {new Date(item.date).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center bg-muted/40 rounded-xl p-3 mb-4">
          <Text className="text-xs text-muted-foreground mr-2">Rol asignado:</Text>
          <View className={`flex-row items-center px-2.5 py-1 rounded-full ${roleBadge.badgeClassName}`}>
            <RoleIcon size={12} color={isAdminRole(item.roleId) ? '#4f46e5' : '#059669'} />
            <Text className={`text-xs font-semibold ml-1 ${roleBadge.textClassName}`}>
              {item.roleName}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
            onPress={() => setInvitationToReject(item.id)}
            disabled={isProcessing}
          >
            {isRejecting ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <>
                <X size={18} color="#ef4444" />
                <Text className="text-red-500 font-semibold ml-2">Rechazar</Text>
              </>
            )}
          </Button>

          <Button
            className="flex-1 h-12"
            onPress={() => {
              void handleAccept(item.id);
            }}
            disabled={isProcessing}
          >
            {isAccepting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Check size={18} color="#ffffff" />
                <Text className="text-primary-foreground font-semibold ml-2">Aceptar</Text>
              </>
            )}
          </Button>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }} className="bg-background">
      <Drawer.Screen options={SCREEN_OPTIONS} />

      <View className="px-5 pt-4 pb-2">
        <Text className="text-sm text-muted-foreground mt-1">
          {invitations.length} {invitations.length === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-bold text-foreground mb-2 text-center">No pudimos cargar tus invitaciones</Text>
          <Text className="text-muted-foreground text-center mb-5">
            {error && (error as any)?.response?.status === 401
              ? 'Tu sesion ha expirado. Inicia sesion de nuevo.'
              : 'Ha ocurrido un error de red. Intentalo en unos segundos.'}
          </Text>
          {(error as any)?.response?.status === 401 ? (
            <Button className="h-11 px-5 bg-indigo-600" onPress={() => { void handleSessionExpired(); }}>
              <Text className="text-white font-semibold">Ir a iniciar sesion</Text>
            </Button>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, flexGrow: invitations.length === 0 ? 1 : 0 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <View className="w-24 h-24 rounded-full bg-muted items-center justify-center mb-5">
                <Inbox size={42} color="#94a3b8" />
              </View>
              <Text className="text-xl font-bold text-foreground mb-2">Sin invitaciones</Text>
              <Text className="text-muted-foreground text-center px-8">
                No tienes invitaciones pendientes a nuevas comunidades en este momento.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={!!invitationToReject} transparent animationType="fade" onRequestClose={() => setInvitationToReject(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full max-w-[360px] bg-card rounded-3xl p-6 border border-border">
            <Text className="text-xl font-bold text-foreground mb-3">Rechazar invitacion</Text>
            <Text className="text-sm text-muted-foreground mb-6">
              Esta accion eliminara la invitacion pendiente y no podra recuperarse desde aqui.
            </Text>

            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onPress={() => setInvitationToReject(null)}
                disabled={!!rejectingId}
              >
                <Text className="font-semibold text-foreground">Cancelar</Text>
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                onPress={() => {
                  void handleReject();
                }}
                disabled={!!rejectingId}
              >
                {rejectingId ? <ActivityIndicator color="#dc2626" /> : <Text className="font-semibold text-red-600 dark:text-red-400">Rechazar</Text>}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
