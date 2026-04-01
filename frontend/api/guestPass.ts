import { apiClient } from "./client";

export interface GuestPassCreate {
    space_id: number;
    valid_for_date: string; 
}

export interface GuestPass {
    id: number;
    user_id: string;
    space_id: number;
    valid_for_date: string;
    qr_token: string;
    status_id: number;
    checked_in_at: string | null;
    created_at: string | null;
}

export interface GuestPassSummary {
    id: number;
    user_id: string;
    space_id: number;
    space_name: string;
    association_id: string;
    requires_qr: boolean;
    valid_for_date: string;
    qr_token: string;
    status_id: number;
    checked_in_at: string | null;
    created_at: string | null;
}

export interface GuestPassCancelResponse {
    id: number;
    deleted: boolean;
}

export const guestPassApi = {
    createGuestPass: async (guestPass: GuestPassCreate): Promise<GuestPass> => {
        const response = await apiClient.post<GuestPass>("/guest-passes/", guestPass);
        return response.data;
    },
    
    listGuestPasses: async (associationId: string): Promise<GuestPassSummary[]> => {
        const response = await apiClient.get<GuestPassSummary[]>(`/guest-passes/me?association_id=${associationId}`);
        return response.data;
    },
    
    cancelGuestPass: async (guestPassId: number): Promise<GuestPassCancelResponse> => {
        const response = await apiClient.patch<GuestPassCancelResponse>(`/guest-passes/${guestPassId}/cancel`);
        return response.data;
    }
};