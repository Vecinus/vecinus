import { apiClient } from './client';
import {
  CreatePollPayload,
  EditPollPayload,
  Poll,
  PollProperty,
  PollPublish,
  PollResults,
  VoteCreate,
  AvailableProperty,
  PendingInvitation,
} from '@/types/polls.types';

export const pollsApi = {
  fetchPolls: async (communityId: string): Promise<Poll[]> => {
    const { data } = await apiClient.get(`/polls/associations/${communityId}`);
    return data;
  },

  fetchPollById: async (pollId: string): Promise<Poll> => {
    const { data } = await apiClient.get(`/polls/${pollId}`);
    return data;
  },

  fetchPollResults: async (communityId: string, pollId: string): Promise<PollResults> => {
    const { data } = await apiClient.get(`/polls/${communityId}/${pollId}/results`);
    return data;
  },

  fetchAvailableProperties: async (communityId: string): Promise<AvailableProperty[]> => {
    const { data } = await apiClient.get(`/${communityId}/properties/available`);
    return data;
  },

  fetchMembershipInfo: async (
    pollId: string
  ): Promise<{ coefficient: number; is_defaulter: boolean }> => {
    const { data } = await apiClient.get(`/polls/${pollId}/membership-info`);
    return data;
  },

  checkUserHasVoted: async (pollId: string): Promise<{ has_voted: boolean }> => {
    const { data } = await apiClient.get(`/polls/${pollId}/has-voted`);
    return data;
  },

  fetchAllProperties: async (communityId: string): Promise<PollProperty[]> => {
    const { data } = await apiClient.get(`/${communityId}/properties`);
    return data;
  },

  fetchPendingInvitations: async (communityId: string): Promise<PendingInvitation[]> => {
    const { data } = await apiClient.get(`/associations/${communityId}/invitations/pending`);
    return data;
  },

  downloadPollPDF: async (pollId: string): Promise<Blob> => {
    const { data } = await apiClient.get(`/polls/${pollId}/pdf`, {
      responseType: 'blob',
    });
    return data;
  },

  createPoll: async (communityId: string, payload: CreatePollPayload): Promise<Poll> => {
    const { data } = await apiClient.post(`/polls/associations/${communityId}`, payload);
    return data;
  },

  editPoll: async (pollId: string, payload: EditPollPayload): Promise<Poll> => {
    const { data } = await apiClient.patch(`/polls/${pollId}`, payload);
    return data;
  },

  deletePoll: async (pollId: string): Promise<any> => {
    const { data } = await apiClient.delete(`/polls/${pollId}`);
    return data;
  },

  publishPoll: async (pollId: string, dates: PollPublish): Promise<Poll> => {
    const { data } = await apiClient.put(`/polls/${pollId}/publish`, dates);
    return data;
  },

  closePoll: async (pollId: string): Promise<Poll> => {
    const { data } = await apiClient.post(`/polls/${pollId}/close`, {});
    return data;
  },

  castVote: async (pollId: string, voteData: VoteCreate): Promise<any> => {
    const { data } = await apiClient.post(`/polls/${pollId}/vote`, voteData);
    return data;
  },

  requestAuthToken: async (pollId: string): Promise<{ message: string; email: string }> => {
    const { data } = await apiClient.post(`/polls/${pollId}/request-auth-token`, {});
    return data;
  },

  markPresumedVotes: async (pollId: string, membershipIds: string[]): Promise<void> => {
    await apiClient.post(`/polls/${pollId}/presumed-votes`, { membershipIds });
  },
};
