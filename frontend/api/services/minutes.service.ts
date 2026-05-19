import { Platform } from 'react-native';
import { apiClient } from '../client';
import { MinutesReadResponse } from '@/types/minutes.types';

export const minutesService = {
  getMinutes: async (
    associationId: string,
    token?: string | null
  ): Promise<MinutesReadResponse[]> => {
    const response = await apiClient.get<MinutesReadResponse[]>(
      `/api/minutes/${associationId}`,
      token
        ? {
            headers: { Authorization: `Bearer ${token}` },
          }
        : undefined
    );
    return response.data;
  },

  transcribe: async (
    associationId: string,
    title: string,
    audioFile: { uri: string; name: string; type: string; durationMs?: number | null },
    options?: { location?: string },
  ): Promise<MinutesReadResponse> => {
    const formData = new FormData();
    formData.append('title', title);
    if (options?.location) {
      formData.append('location', options.location);
    }
    formData.append('scheduled_at', new Date().toISOString());
    if (
      typeof audioFile.durationMs === 'number' &&
      Number.isFinite(audioFile.durationMs) &&
      audioFile.durationMs > 0
    ) {
      formData.append('duration_ms', String(Math.ceil(audioFile.durationMs)));
    }

    if (Platform.OS === 'web') {
      const response = await fetch(audioFile.uri);
      let blob = await response.blob();
      blob = new Blob([blob], { type: audioFile.type });
      formData.append('audio', blob, audioFile.name);
    } else {
      formData.append('audio', {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.type,
      } as unknown as Blob);
    }
    const response = await apiClient.post<MinutesReadResponse>(
      `/api/minutes/${encodeURIComponent(associationId)}/transcribe`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};
