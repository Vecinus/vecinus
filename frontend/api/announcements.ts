import { apiClient } from './client';
import {
  Announcement,
  AnnouncementCreate,
  AnnouncementUpdate,
  AnnouncementStatus
} from '@/types/announcements.types';

export type { Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementStatus };

async function appendFileToFormData(
  formData: FormData,
  image: { uri: string; name?: string; mimeType?: string; type?: string; file?: unknown } | undefined
) {
  if (!image || !image.uri) return;

  const fileName = image.name || 'image.jpg';
  const mimeType = image.mimeType || image.type || 'image/jpeg';
  const maybeFile = (image as any).file;

  // On web, if we have a real Blob/File object, use it directly
  if (typeof Blob !== 'undefined' && maybeFile instanceof Blob) {
    formData.append('file', maybeFile, fileName);
  } else if (typeof fetch !== 'undefined' && image.uri.startsWith('data:')) {
    // Web fallback: convert data URI to Blob
    try {
      const response = await fetch(image.uri);
      const blob = await response.blob();
      formData.append('file', blob, fileName);
    } catch {
      // Last resort: try RN-style object
      formData.append('file', {
        uri: image.uri,
        name: fileName,
        type: mimeType,
      } as any);
    }
  } else {
    // React Native style: pass as object (works on native)
    formData.append('file', {
      uri: image.uri,
      name: fileName,
      type: mimeType,
    } as any);
  }
}

export const announcementsApi = {
  getAnnouncements: async (communityId: string, status?: AnnouncementStatus): Promise<Announcement[]> => {
    const response = await apiClient.get<Announcement[]>(`/announcements/${communityId}`, {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  getAnnouncement: async (communityId: string, announcementId: string): Promise<Announcement> => {
    const response = await apiClient.get<Announcement>(`/announcements/${communityId}/${announcementId}`);
    return response.data;
  },

  createAnnouncement: async (communityId: string, data: AnnouncementCreate): Promise<Announcement> => {
    const formData = new FormData();

    formData.append('title', data.title);
    formData.append('content', data.content);
    formData.append('status', data.status || 'DRAFT');

    if (data.scheduled_date) {
      formData.append('scheduled_date', data.scheduled_date);
    }

    await appendFileToFormData(formData, data.image);

    const response = await apiClient.post<Announcement>(
      `/announcements/${communityId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  updateAnnouncement: async (communityId: string, announcementId: string, data: AnnouncementUpdate): Promise<Announcement> => {
    const formData = new FormData();

    // Only append fields that actually have a value
    if (data.title) formData.append('title', data.title);
    if (data.content) formData.append('content', data.content);
    if (data.status) formData.append('status', data.status);

    if (data.scheduled_date) {
      formData.append('scheduled_date', data.scheduled_date);
    }

    await appendFileToFormData(formData, data.image);

    const response = await apiClient.put<Announcement>(
      `/announcements/${communityId}/${announcementId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  deleteAnnouncement: async (communityId: string, announcementId: string): Promise<void> => {
    await apiClient.delete(`/announcements/${communityId}/${announcementId}`);
  },
};