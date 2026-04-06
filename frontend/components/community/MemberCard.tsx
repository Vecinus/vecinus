import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { ShieldCheck, Key, User, Crown, Briefcase, Trash2 } from 'lucide-react-native';
import type { Member } from '@/api/community';

export const getRoleConfig = (roleId: number) => {
  switch (roleId) {
    case 1: return { icon: ShieldCheck, iconColor: '#6366f1', bgName: 'bg-indigo-100 dark:bg-indigo-900/40', textColor: 'text-indigo-600 dark:text-indigo-400' };
    case 4: return { icon: Crown,       iconColor: '#f59e0b', bgName: 'bg-amber-100 dark:bg-amber-900/40',   textColor: 'text-amber-600 dark:text-amber-500' };
    case 2: return { icon: Key,         iconColor: '#10b981', bgName: 'bg-emerald-100 dark:bg-emerald-900/40', textColor: 'text-emerald-600 dark:text-emerald-400' };
    case 3: return { icon: User,        iconColor: '#3b82f6', bgName: 'bg-blue-100 dark:bg-blue-900/40',     textColor: 'text-blue-600 dark:text-blue-400' };
    case 5: return { icon: Briefcase,   iconColor: '#64748b', bgName: 'bg-slate-100 dark:bg-slate-800',      textColor: 'text-slate-600 dark:text-slate-400' };
    default:return { icon: User,        iconColor: '#94a3b8', bgName: 'bg-slate-100 dark:bg-slate-800',      textColor: 'text-slate-500 dark:text-slate-400' };
  }
};

interface MemberCardProps {
  member: Member;
  isMe: boolean;
  canDelete: boolean;
  onDelete: (membershipId: string, memberName: string) => void;
  isDeleting: boolean;
}

export function MemberCard({ member, isMe, canDelete, onDelete, isDeleting }: MemberCardProps) {
  const { icon: RoleIcon, iconColor, bgName, textColor } = getRoleConfig(member.roleId);
  const showDelete = canDelete && !isMe && member.roleId !== 1 && member.roleId !== 4;

  return (
    <View 
      className={`flex-row items-center p-4 mb-3 rounded-2xl border ${
        isMe 
          ? 'bg-primary/5 border-primary/30' 
          : 'bg-card border-border shadow-sm'
      }`}
    >
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${bgName}`}>
        <RoleIcon size={22} color={iconColor} strokeWidth={2.5} />
      </View>
      
      <View className="flex-1">
        <Text className="text-base font-bold text-foreground mb-0.5">
          {member.name} {isMe && <Text className="text-primary font-bold">(Tú)</Text>}
        </Text>
        <Text className={`text-xs font-semibold ${textColor}`}>
          {member.roleName}
        </Text>
      </View>

      {showDelete && (
        <TouchableOpacity 
          className="p-2.5 bg-destructive/10 dark:bg-destructive/20 rounded-xl"
          onPress={() => onDelete(member.membershipId, member.name)}
          disabled={isDeleting}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Trash2 size={20} color="#ef4444" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
