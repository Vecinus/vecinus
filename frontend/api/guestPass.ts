import { apiClient } from "./client";
import { GuestPass, GuestPassCancelResponse,GuestPassCreate,GuestPassSummary } from "@/types/guess_pass.types";

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