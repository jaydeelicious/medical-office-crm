import {
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';

export function appointmentFutureValidator(
    control: AbstractControl,
): ValidationErrors | null {
    const date = control.get('date')?.value as string;
    const startTime = control.get('startTime')?.value as string;

    if (!date || !startTime) {
        return null;
    }

    // Only compare complete local date and time values.
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
    ) {
        return null;
    }

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const today = `${year}-${month}-${day}`;

    if (date < today) {
        return { pastAppointment: true };
    }

    if (date > today) {
        return null;
    }

    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');

    const currentTime = `${currentHour}:${currentMinute}`;

    // The current minute is considered past because an appointment
    // must have a start time later than the current time.
    return startTime <= currentTime
        ? { pastAppointment: true }
        : null;
}