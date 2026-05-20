import { apiClient } from './client';

export interface CommonSpace {
  id: number;
  association_id: string;
  created_at?: string;
  name: string;
  requires_qr?: boolean;
  capacity?: number;
  max_guests_per_reservation?: number;
  usage_mode?: string | 'exclusive_reservation';
  start_time?: string | null;
  end_time?: string | null;
}

export interface CommonSpaceUpdate {
  name: string;
  capacity?: number;
  requires_qr?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  usage_mode?: 'exclusive_reservation' | 'guest_pass';
  max_guests_per_reservation?: number;
}

export const commonSpaceApi = {
  listCommonSpaces: async (associationId: string): Promise<CommonSpace[]> => {
    const response = await apiClient.get<CommonSpace[]>(`/common-spaces/${associationId}`);
    return response.data;
  },

  createCommonSpace: async (
    associationId: string,
    payload: CommonSpaceUpdate
  ): Promise<CommonSpace> => {
    const response = await apiClient.post<CommonSpace>(`/common-spaces/${associationId}`, payload);
    return response.data;
  },

  updateCommonSpace: async (
    associationId: string,
    spaceId: number,
    payload: CommonSpaceUpdate
  ): Promise<CommonSpace> => {
    const response = await apiClient.put<CommonSpace>(
      `/common-spaces/${associationId}/${spaceId}`,
      payload
    );
    return response.data;
  },

  deleteCommonSpace: async (
    associationId: string,
    spaceId: number,
    force = false
  ): Promise<void> => {
    await apiClient.delete(`/common-spaces/${associationId}/${spaceId}`, {
      params: force ? { force: true } : undefined,
    });
  },
};
