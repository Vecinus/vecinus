import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communityApi, type UserInvitation } from '@/api/community';

export const invitationQueryKeys = {
  all: ['invitations'] as const,
  mine: () => [...invitationQueryKeys.all, 'mine'] as const,
};

export const useMyInvitations = () => {
  return useQuery<UserInvitation[], Error>({
    queryKey: invitationQueryKeys.mine(),
    queryFn: () => communityApi.getMyInvitations(),
    staleTime: 1000 * 60,
  });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (invitationId: string) => communityApi.acceptInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationQueryKeys.mine() });
    },
  });
};

export const useRejectInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (invitationId: string) => communityApi.rejectInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationQueryKeys.mine() });
    },
  });
};
