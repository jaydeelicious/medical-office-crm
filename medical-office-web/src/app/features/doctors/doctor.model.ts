export interface Doctor {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    specialty: string;
}

export interface CreateDoctorRequest {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
    specialty: string;
}

export type UpdateDoctorRequest = CreateDoctorRequest;