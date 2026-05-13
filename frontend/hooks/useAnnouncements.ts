import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, type AnnouncementStatus, type AnnouncementCreate, type AnnouncementUpdate } from '@/api/announcements';

interface ApiError {
  response?: {
    status?: number;
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

function shouldRetryQuery(error: unknown, failureCount: number) {
  const apiError = error as ApiError;
  if (apiError.response?.status === 402 || apiError.response?.status === 403) {
    return false;
  }
  return failureCount < 3;
}

export const useAnnouncementsList = (
  communityId: string | undefined,
  status?: AnnouncementStatus,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['announcements', communityId, status],
    queryFn: () => {
      if (!communityId) throw new Error('Community ID required');
      return announcementsApi.getAnnouncements(communityId, status);
    },
    enabled: !!communityId && enabled,
    staleTime: 1000 * 60 * 5, // 5 mins
    retry: shouldRetryQuery,
  });
};

export const useAnnouncementDetail = (communityId: string | undefined, announcementId: string | undefined) => {
  return useQuery({
    queryKey: ['announcements', communityId, 'detail', announcementId],
    queryFn: () => {
      if (!communityId || !announcementId) throw new Error('Community ID and Announcement ID required');
      return announcementsApi.getAnnouncement(communityId, announcementId);
    },
    enabled: !!communityId && !!announcementId,
    retry: shouldRetryQuery,
  });
};

export const useCreateAnnouncement = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AnnouncementCreate) => {
      if (!communityId) throw new Error('Community ID required');
      return announcementsApi.createAnnouncement(communityId, data);
    },
    onSuccess: () => {
      if (communityId) {
        void queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
      }
    },
  });
};

export const useUpdateAnnouncement = (communityId: string | undefined, announcementId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AnnouncementUpdate) => {
      if (!communityId || !announcementId) throw new Error('Community ID and Announcement ID required');
      return announcementsApi.updateAnnouncement(communityId, announcementId, data);
    },
    onSuccess: () => {
      if (communityId) {
        void queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
        if (announcementId) {
          void queryClient.invalidateQueries({ queryKey: ['announcements', communityId, 'detail', announcementId] });
        }
      }
    },
  });
};

export const useDeleteAnnouncement = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId: string) => {
      if (!communityId) throw new Error('Community ID required');
      return announcementsApi.deleteAnnouncement(communityId, announcementId);
    },
    onSuccess: () => {
      if (communityId) {
        void queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
      }
    },
  });
};
