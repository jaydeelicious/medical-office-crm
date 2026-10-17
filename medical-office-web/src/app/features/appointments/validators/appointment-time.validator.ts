import {
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';

export function appointmentTimeValidator(
    control: AbstractControl,
): ValidationErrors | null {
    const date = control.get('date')?.value as string;
    const startTime = control.get('startTime')?.value as string;
    const endTime = control.get('endTime')?.value as string;

    if (!date || !startTime || !endTime) {
        return null;
    }

    return startTime < endTime
        ? null
        : { invalidTimeRange: true };
}