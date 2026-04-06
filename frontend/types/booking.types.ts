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