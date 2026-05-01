import { Platform } from 'react-native';
import { apiClient } from '../client';
import { MinutesReadResponse } from '@/types/minutes.types';

export const minutesService = {
  getMinutes: async (associationId: string): Promise<MinutesReadResponse[]> => {
    const response = await apiClient.get<MinutesReadResponse[]>(`/api/minutes/${associationId}`);
    return response.data;
  },

  transcribe: async (
    associationId: string,
    title: string,
    audioFile: { uri: string; name: string; type: string }
  ): Promise<MinutesReadResponse> => {
    const formData = new FormData();

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
      `/api/minutes/transcribe?association_id=${encodeURIComponent(associationId)}&title=${encodeURIComponent(title)}`,
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
