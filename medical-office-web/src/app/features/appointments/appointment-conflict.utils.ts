import { HttpErrorResponse } from '@angular/common/http';

export type AppointmentConflictCode = 
    | 'APPOINTMENT_OVERLAP'
    | 'STALE_APPOINTMENT';

export function getAppointmentConflictCode(
    error: unknown,
): AppointmentConflictCode | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
        return null;
    }

    const body: unknown = error.error;

    if (body === null || typeof body !== 'object') {
        return null;
    }

    if (!('code' in body)) {
        return null;
    }

    switch (body.code) {
        case 'APPOINTMENT_OVERLAP':
            return 'APPOINTMENT_OVERLAP';
        
        case 'STALE_APPOINTMENT':
            return 'STALE_APPOINTMENT';

        default:
            return null;
    }
}