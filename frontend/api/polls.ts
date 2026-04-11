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
  // 1. Mantenemos el /associations/ (coincide con @router.get("/associations/{association_id}"))
  fetchPolls: async (communityId: string): Promise<Poll[]> => {
    const { data } = await apiClient.get(`/polls/associations/${communityId}`);
    return data;
  },

  // 2. Mantenemos el /polls/ (coincide con @router.get("/{poll_id}"))
  fetchPollById: async (pollId: string): Promise<Poll> => {
    const { data } = await apiClient.get(`/polls/${pollId}`);
    return data;
  },

  // 3. ✅ CORRECCIÓN: La ruta original tenía /polls/ primero.
  // En tu backend tienes @router.get("/{association_id}/{poll_id}/results") bajo el prefijo "/polls"
  fetchPollResults: async (communityId: string, pollId: string): Promise<PollResults> => {
    const { data } = await apiClient.get(`/polls/${communityId}/${pollId}/results`);
    return data;
  },

  // 4. Mantenemos las llamadas a properties sin /associations
  // ya que asumen que la API base incluye el prefix del main.py si lo configuraste.
  // (Si en main.py está app.include_router(associations_router) SIN prefix, esto debe llevar /associations)
  fetchAvailableProperties: async (communityId: string): Promise<AvailableProperty[]> => {
    const { data } = await apiClient.get(`${communityId}/properties/available`);
    return data;
  },

  fetchAllProperties: async (communityId: string): Promise<PollProperty[]> => {
    const { data } = await apiClient.get(`/associations/${communityId}/properties`);
    return data;
  },

  fetchPendingInvitations: async (communityId: string): Promise<PendingInvitation[]> => {
    const { data } = await apiClient.get(`/associations/${communityId}/invitations/pending`);
    return data;
  },

  // // 5. Cuidado: No tienes un endpoint de PDF en tu polls.py actual.
  // // Si no lo vas a usar, deberías comentarlo o crear el endpoint en el backend.
  // downloadPollPDF: async (pollId: string): Promise<Blob> => {
  //   const { data } = await apiClient.get(`/polls/${pollId}/pdf`, {
  //     responseType: 'blob',
  //   });
  //   return data;
  // },

  createPoll: async (communityId: string, payload: CreatePollPayload): Promise<Poll> => {
    const { data } = await apiClient.post(`/polls/associations/${communityId}`, payload);
    return data;
  },

  editPoll: async (pollId: string, payload: EditPollPayload): Promise<Poll> => {
    const { data } = await apiClient.patch(`/polls/${pollId}`, payload);
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

  // 8. Cuidado: No tienes @router.post("/{poll_id}/presumed-votes") en tu polls.py
  markPresumedVotes: async (pollId: string, membershipIds: string[]): Promise<void> => {
    await apiClient.post(`/polls/${pollId}/presumed-votes`, { membershipIds });
  },
};
