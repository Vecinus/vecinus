import { apiClient } from "./client"
import { OccupiedSlot, Reservation, ReservationCancelResponse, ReservationCreate, ReservationSummary, QRValidateRequest, QRValidationResponse } from "@/types/booking.types";

export const bookingApi = {
    createReservation: async (reservation: ReservationCreate): Promise<Reservation> => {
        const response = await apiClient.post<Reservation>("/reservations/", reservation);
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