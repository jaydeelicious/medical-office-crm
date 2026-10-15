export enum AppointmentStatus {
    Scheduled = 0,
    Completed = 1,
    Cancelled = 2,
    NoShow = 3,
}

export interface Appointment {
    id: string;
    patientId: string;
    doctorId: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    notes: string | null;
}

export interface CreateAppointmentRequest {
    patientId: string;
    doctorId: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
}

export interface RescheduleAppointmentRequest {
    startTime: string;
    endTime: string;
}

export interface UpdateAppointmentStatusRequest {
    status: AppointmentStatus;
}

export interface AppointmentFilters {
    doctorId?: string;
    date?: string;
}