import { apiClient } from '../client';
import {
  PollReadResponse,
  PollCreateRequest,
  PollUpdateRequest,
  PollPublishRequest,
  VoteCreatePayload,
  VoteResponse,
  PollResultResponse,
  MembershipInfoResponse,
  HasVotedResponse,
  RequestAuthTokenResponse,
} from '@/types/poll.types';

export const pollService = {
  getPolls: async (associationId: string): Promise<PollReadResponse[]> => {
    const response = await apiClient.get<PollReadResponse[]>(
      `/polls/associations/${associationId}`
    );
    return response.data;
  },

  getPoll: async (pollId: string): Promise<PollReadResponse> => {
    const response = await apiClient.get<PollReadResponse>(`/polls/${pollId}`);
    return response.data;
  },

  createPoll: async (
    associationId: string,
    data: PollCreateRequest
  ): Promise<PollReadResponse> => {
    const response = await apiClient.post<PollReadResponse>(
      `/polls/associations/${associationId}`,
      data
    );
    return response.data;
  },

  updatePoll: async (
    pollId: string,
    data: PollUpdateRequest
  ): Promise<PollReadResponse> => {
    const response = await apiClient.patch<PollReadResponse>(`/polls/${pollId}`, data);
    return response.data;
  },

  deletePoll: async (pollId: string): Promise<void> => {
    await apiClient.delete(`/polls/${pollId}`);
  },

  publishPoll: async (
    pollId: string,
    data: PollPublishRequest
  ): Promise<PollReadResponse> => {
    const response = await apiClient.put<PollReadResponse>(
      `/polls/${pollId}/publish`,
      data
    );
    return response.data;
  },

  closePoll: async (pollId: string): Promise<PollReadResponse> => {
    const response = await apiClient.post<PollReadResponse>(`/polls/${pollId}/close`);
    return response.data;
  },

  vote: async (pollId: string, payload: VoteCreatePayload): Promise<VoteResponse> => {
    const response = await apiClient.post<VoteResponse>(`/polls/${pollId}/vote`, payload);
    return response.data;
  },

  submitVote: async (
    pollId: string,
    token: string,
    selectedOption: string,
    rgpdAccepted: boolean
  ): Promise<VoteResponse> => {
    const payload: VoteCreatePayload = {
      selected_option: selectedOption,
      voting_token: token,
      rgpd_accepted: rgpdAccepted,
    };
    const response = await apiClient.post<VoteResponse>(`/polls/${pollId}/vote`, payload);
    return response.data;
  },

  getResults: async (
    associationId: string,
    pollId: string
  ): Promise<PollResultResponse> => {
    const response = await apiClient.get<PollResultResponse>(
      `/polls/${associationId}/${pollId}/results`
    );
    return response.data;
  },

  getMembershipInfo: async (pollId: string): Promise<MembershipInfoResponse> => {
    const response = await apiClient.get<MembershipInfoResponse>(
      `/polls/${pollId}/membership-info`
    );
    return response.data;
  },

  hasVoted: async (pollId: string): Promise<HasVotedResponse> => {
    const response = await apiClient.get<HasVotedResponse>(`/polls/${pollId}/has-voted`);
    return response.data;
  },

  requestAuthToken: async (pollId: string): Promise<RequestAuthTokenResponse> => {
    const response = await apiClient.post<RequestAuthTokenResponse>(
      `/polls/${pollId}/request-auth-token`
    );
    return response.data;
  },
};