import { apiClient } from "./client"

export interface ReservationCreate {
    space_id: number;     
    start_at: string;     
    end_at: string;       
    guests_count: number; 
}

// Nueva interfaz añadida
export interface QRValidateRequest {
    qr_token: string;
    association_id: string;
}

export interface Reservation {
    id: number;           
    user_id: string;      
    space_id: number;
    start_at: string;
    end_at: string;
    qr_token: string;
    status_id: number;
    guests_count: number;
}

export interface OccupiedSlot {
    start_at: string;
    end_at: string;
}

export interface ReservationSummary {
    id: number;
    user_id: string;
    space_id: number;
    space_name: string;
    association_id: string;
    requires_qr: boolean;
    start_at: string;
    end_at: string;
    qr_token: string;
    status_id: number; 
    guests_count: number;
}

export interface ReservationCancelResponse {
    id: number;
    deleted: boolean;
}

export interface QRValidationResponse {
    guests_count: number;
    status: string;
    space_name?: string | null;
    type?: string | null;
}

export const bookingApi = {
    createReservation: async (reservation: ReservationCreate): Promise<Reservation> => {
        const response = await apiClient.post<Reservation>("/reservations", reservation);
        return response.data;
    },
    
    listReservations: async (associationId: string): Promise<ReservationSummary[]> => {
        const response = await apiClient.get<ReservationSummary[]>(`/reservations/me?association_id=${associationId}`);
        return response.data;
    },
    
    listOccupiedSlots: async (spaceId: number, date: string): Promise<OccupiedSlot[]> => {
        const response = await apiClient.get<OccupiedSlot[]>(`/reservations/occupied-slots?space_id=${spaceId}&reservation_date=${date}`);
        return response.data;
    },
    cancelReservation: async (reservationId: number): Promise<ReservationCancelResponse> => {
        const response = await apiClient.patch<ReservationCancelResponse>(`/reservations/${reservationId}/cancel`);
        return response.data;
    },
    validateQr: async (data: QRValidateRequest): Promise<QRValidationResponse> => {
        const response = await apiClient.post<QRValidationResponse>("/reservations/validate-qr", data);
        return response.data;
    }
}