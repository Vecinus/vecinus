import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, type AnnouncementStatus } from '@/api/announcements';

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
  });
};

export const useCreateAnnouncement = (communityId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; content: string; status: AnnouncementStatus; scheduled_date?: string; image?: any }) => {
      if (!communityId) throw new Error('Community ID required');
      return announcementsApi.createAnnouncement(communityId, data);
    },
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
      }
    },
  });
};

export const useUpdateAnnouncement = (communityId: string | undefined, announcementId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title?: string; content?: string; status?: AnnouncementStatus; scheduled_date?: string; image?: any }) => {
      if (!communityId || !announcementId) throw new Error('Community ID and Announcement ID required');
      return announcementsApi.updateAnnouncement(communityId, announcementId, data);
    },
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
        if (announcementId) {
          queryClient.invalidateQueries({ queryKey: ['announcements', communityId, 'detail', announcementId] });
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
        queryClient.invalidateQueries({ queryKey: ['announcements', communityId] });
      }
    },
  });
};
