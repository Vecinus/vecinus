import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  incidentsApi,
  type CreateIncidentPayload,
  type Incident,
  type IncidentDetail,
  type IncidentStatus,
} from '@/api/incidents';

export const incidentQueryKeys = {
  all: ['incidents'] as const,
  list: (communityId: string | undefined, mine: boolean, userScope?: string) =>
    [...incidentQueryKeys.all, 'list', communityId, mine, userScope ?? 'anon'] as const,
  detail: (communityId: string | undefined, incidentId: string | null, userScope?: string) =>
    [...incidentQueryKeys.all, 'detail', communityId, incidentId, userScope ?? 'anon'] as const,
};

export const useIncidentsList = (
  communityId: string | undefined,
  mine = false,
  enabled = true,
  userScope?: string
) => {
  return useQuery<Incident[], Error>({
    queryKey: incidentQueryKeys.list(communityId, mine, userScope),
    queryFn: () => incidentsApi.listIncidents(communityId as string, mine),
    enabled: !!communityId && enabled,
    staleTime: 1000 * 30,
  });
};

export const useIncidentDetail = (
  communityId: string | undefined,
  incidentId: string | null,
  enabled = true,
  userScope?: string
) => {
  return useQuery<IncidentDetail, Error>({
    queryKey: incidentQueryKeys.detail(communityId, incidentId, userScope),
    queryFn: () => incidentsApi.getIncidentDetail(communityId as string, incidentId as string),
    enabled: !!communityId && !!incidentId && enabled,
  });
};

export const useCreateIncident = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<{ incidentId?: string }, Error, CreateIncidentPayload>({
    mutationFn: (payload) => incidentsApi.createIncident(communityId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incidentQueryKeys.all });
    },
  });
};

export const useUpdateIncidentStatus = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { incidentId: string; status: IncidentStatus }>({
    mutationFn: ({ incidentId, status }) => incidentsApi.updateIncidentStatus(communityId as string, incidentId, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: incidentQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: [...incidentQueryKeys.all, 'detail', communityId, variables.incidentId] });
    },
  });
};

export const useDiscardIncident = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { incidentId: string }>({
    mutationFn: ({ incidentId }) => incidentsApi.discardIncident(communityId as string, incidentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: incidentQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: [...incidentQueryKeys.all, 'detail', communityId, variables.incidentId] });
    },
  });
};
