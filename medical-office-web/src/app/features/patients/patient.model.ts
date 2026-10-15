export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    dateOfBirth: string | null;
}

export interface CreatePatientRequest {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
    dateOfBirth?: string | null;
}

export type UpdatePatientRequest = CreatePatientRequest;