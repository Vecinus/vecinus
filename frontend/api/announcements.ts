import { apiClient } from './client';
import {
  Announcement,
  AnnouncementCreate,
  AnnouncementUpdate,
  AnnouncementStatus
} from '@/types/announcements.types';

export type { Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementStatus };

export const ANNOUNCEMENT_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;

type AnnouncementImageAsset = {
  uri: string;
  name?: string;
  mimeType?: string;
  type?: string;
  size?: number | null;
  file?: unknown;
};

function inferMimeTypeFromName(name: string | undefined): string | undefined {
  const lowerName = name?.toLowerCase() || '';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return undefined;
}

export function validateAnnouncementImageAsset(image: AnnouncementImageAsset | undefined): string | undefined {
  if (!image || !image.uri) return undefined;

  const blobType = typeof Blob !== 'undefined' && image.file instanceof Blob ? image.file.type : undefined;
  const mimeType = image.mimeType || image.type || blobType || inferMimeTypeFromName(image.name);
  if (!mimeType || !ANNOUNCEMENT_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error('Solo se permiten imagenes JPEG, PNG o WebP.');
  }

  const blobSize = typeof Blob !== 'undefined' && image.file instanceof Blob ? image.file.size : undefined;
  const size = typeof image.size === 'number' ? image.size : blobSize;
  if (typeof size === 'number' && size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    throw new Error('La imagen no puede exceder 5MB.');
  }

  return mimeType;
}

async function appendFileToFormData(
  formData: FormData,
  image: AnnouncementImageAsset | undefined
) {
  if (!image || !image.uri) return;

  const fileName = image.name || 'image.jpg';
  const mimeType = validateAnnouncementImageAsset(image) || 'image/jpeg';
  const maybeFile = image.file;

  // On web, if we have a real Blob/File object, use it directly
  if (typeof Blob !== 'undefined' && maybeFile instanceof Blob) {
    formData.append('file', maybeFile, fileName);
  } else if (typeof fetch !== 'undefined' && (image.uri.startsWith('data:') || image.uri.startsWith('blob:'))) {
    // Web: convert data URI or blob URI to a proper Blob object
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
      } as unknown as Blob);
    }
  } else {
    // React Native style: pass as object (works on native)
    formData.append('file', {
      uri: image.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
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
