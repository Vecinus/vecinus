import { apiClient } from "./client"

export interface CommonSpace {
    id: number
    association_id: string
    created_at?: string
    name: string
    requires_qr?: boolean 
    max_capacity?: number 
    max_guests_per_reservation?: number 
    photo_url?: string | null 
    usage_mode?: string | "exclusive_reservation"
}

export const commonSpaceApi = {
  listCommonSpaces: async (associationId: string): Promise<CommonSpace[]> => {
    const response = await apiClient.get<CommonSpace[]>(`/common-spaces/${associationId}`);
    return response.data;
  },
};