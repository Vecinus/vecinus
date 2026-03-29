import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityApi } from '../api/community';
import type { Member, PendingInvitation, Property } from '../api/community';

export const communityQueryKeys = {
  all: ['communityAdmin'] as const,
  members: (communityId: string | undefined) => [...communityQueryKeys.all, 'members', communityId] as const,
  pendingInvitations: (communityId: string | undefined) => [...communityQueryKeys.all, 'pendingInvitations', communityId] as const,
  availableProperties: (communityId: string | undefined) => [...communityQueryKeys.all, 'availableProperties', communityId] as const,
};

export const useCommunityMembers = (communityId: string | undefined, hasAdminRole: boolean) => {
  return useQuery<Member[], Error>({
    queryKey: communityQueryKeys.members(communityId),
    queryFn: () => communityApi.getMembers(communityId!),
    enabled: !!communityId && hasAdminRole,
    staleTime: 1000 * 60 * 5, // Cachea durante 5 mins para mejor UX
    retry: 1 // Intenta volver a conectar una vez si falla Network
  });
};

export const usePendingInvitations = (communityId: string | undefined, hasAdminRole: boolean) => {
  return useQuery<PendingInvitation[], Error>({
    queryKey: communityQueryKeys.pendingInvitations(communityId),
    queryFn: () => communityApi.getPendingInvitations(communityId!),
    enabled: !!communityId && hasAdminRole,
  });
};

export const useAvailableProperties = (communityId: string | undefined, hasAdminRole: boolean) => {
  return useQuery<Property[], Error>({
    queryKey: communityQueryKeys.availableProperties(communityId),
    queryFn: () => communityApi.getAvailableProperties(communityId!),
    enabled: !!communityId && hasAdminRole,
  });
};

export const useDeleteMember = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) => communityApi.deleteMember(membershipId),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: communityQueryKeys.members(communityId) });
      }
    },
  });
};

export const useInviteMember = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; roleToGrant: number; propertyId?: string }) => 
      communityApi.inviteMember({ ...data, communityId: communityId! }),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: communityQueryKeys.pendingInvitations(communityId) });
        queryClient.invalidateQueries({ queryKey: communityQueryKeys.members(communityId) });
      }
    },
  });
};

export const useAddProperty = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyNumber: string) => communityApi.addProperty(communityId!, propertyNumber),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: communityQueryKeys.availableProperties(communityId) });
      }
    },
  });
};
