import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Mail, ShieldCheck, Key, User, Crown, Briefcase } from 'lucide-react-native';
import type { PendingInvitation } from '@/api/community';

export const getRoleConfig = (roleId: number) => {
  switch (roleId) {
    case 1: return { icon: ShieldCheck, color: '#6366f1', name: 'Administrador' };
    case 4: return { icon: Crown,       color: '#f59e0b', name: 'Presidente' };
    case 2: return { icon: Key,         color: '#10b981', name: 'Propietario' };
    case 3: return { icon: User,        color: '#3b82f6', name: 'Inquilino' };
    case 5: return { icon: Briefcase,   color: '#64748b', name: 'Empleado' };
    default:return { icon: User,        color: '#94a3b8', name: 'Desconocido' };
  }
};

interface PendingInvitationCardProps {
  invitation: PendingInvitation;
}

export function PendingInvitationCard({ invitation }: PendingInvitationCardProps) {
  const { icon: RoleIcon, color: roleColor, name: roleName } = getRoleConfig(invitation.role_to_grant);

  return (
    <View className="flex-row items-center p-3.5 mb-2.5 bg-background dark:bg-card border border-amber-50 dark:border-amber-900/10 rounded-2xl shadow-sm">
      <View className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mr-3.5">
        <Mail size={18} color="#64748b" />
      </View>
      
      <View className="flex-1">
        <Text className="text-sm font-bold text-foreground mb-0.5" numberOfLines={1}>
          {invitation.target_email}
        </Text>
        <View className="flex-row items-center">
          <RoleIcon size={12} color={roleColor} style={{ marginRight: 4 }} />
          <Text className="text-xs font-semibold" style={{ color: roleColor }}>
            {roleName}
          </Text>
        </View>
      </View>

      <View className="bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-700/50">
        <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest">
          Pendiente
        </Text>
      </View>
    </View>
  );
}
