import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApi } from '@/api/polls';
import {
  Poll,
  PollResults,
  CreatePollPayload,
  EditPollPayload,
  VoteCreate,
  AvailableProperty,
  PendingInvitation,
  PollPublish,
} from '@/types/polls.types';

const POLL_STALE_TIME = 1000 * 60 * 5;

export const usePolls = (communityId: string) => {
  return useQuery({
    queryKey: ['polls', communityId],
    queryFn: () => pollsApi.fetchPolls(communityId),
    staleTime: POLL_STALE_TIME,
    enabled: !!communityId,
  });
};

export const usePollById = (pollId: string) => {
  return useQuery({
    queryKey: ['poll', pollId],
    queryFn: () => pollsApi.fetchPollById(pollId),
    enabled: !!pollId,
  });
};

export const usePollResults = (communityId: string, pollId: string) => {
  return useQuery({
    queryKey: ['poll-results', pollId],
    queryFn: () => pollsApi.fetchPollResults(communityId, pollId),
    enabled: !!communityId && !!pollId,
  });
};

export const useAvailableProperties = (communityId: string) => {
  return useQuery({
    queryKey: ['available-properties', communityId],
    queryFn: () => pollsApi.fetchAvailableProperties(communityId),
    enabled: !!communityId,
  });
};

export const usePendingInvitations = (communityId: string) => {
  return useQuery({
    queryKey: ['pending-invitations', communityId],
    queryFn: () => pollsApi.fetchPendingInvitations(communityId),
    enabled: !!communityId,
  });
};

export const useCreatePollMutation = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePollPayload) => pollsApi.createPoll(communityId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', communityId] });
    },
  });
};

export const useEditPollMutation = (communityId: string, pollId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EditPollPayload) => pollsApi.editPoll(pollId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', communityId] });
      queryClient.invalidateQueries({ queryKey: ['poll', pollId] });
    },
  });
};

export const useDeletePollMutation = (communityId: string, pollId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pollsApi.deletePoll(pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', communityId] });
      queryClient.removeQueries({ queryKey: ['poll', pollId] });
    },
  });
};

export const usePublishPollMutation = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, dates }: { pollId: string; dates: PollPublish }) =>
      pollsApi.publishPoll(pollId, dates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', communityId] });
    },
  });
};

export const useClosePollMutation = (communityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => pollsApi.closePoll(pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', communityId] });
    },
  });
};

export const useCastVoteMutation = (pollId: string) => {
  return useMutation({
    mutationFn: (voteData: VoteCreate) => pollsApi.castVote(pollId, voteData),
  });
};

export const useMarkPresumpedVotesMutation = (pollId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipIds: string[]) => pollsApi.markPresumpedVotes(pollId, membershipIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll-results', pollId] });
    },
  });
};

export const useDownloadPollPDF = () => {
  return useMutation({
    mutationFn: (pollId: string) => pollsApi.downloadPollPDF(pollId),
  });
};
