
import { FormControl, FormGroup } from '@angular/forms';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { appointmentFutureValidator } from './appointment-future.validator';

describe('appointmentFutureValidator', () => {
    beforeEach(() => {
        vi.useFakeTimers();

        // Local time, not UTC.
        vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function validate(
        date: string,
        startTime: string,
    ) {
        const form = new FormGroup({
            date: new FormControl(date),
            startTime: new FormControl(startTime),
        });

        return appointmentFutureValidator(form);
    }

    it('rejects a past date', () => {
        expect(validate('2026-11-15', '14:00')).toEqual({
            pastAppointment: true,
        });
    });

    it('rejects an earlier time today', () => {
        expect(validate('2026-11-16', '09:00')).toEqual({
            pastAppointment: true,
        });
    });

    it('rejects the current minute', () => {
        expect(validate('2026-11-16', '10:30')).toEqual({
            pastAppointment: true,
        });
    });

    it('accepts a later time today', () => {
        expect(validate('2026-11-16', '10:31')).toBeNull();
    });

    it('accepts a future date', () => {
        expect(validate('2026-11-17', '09:00')).toBeNull();
    });

    it('does not report past-date errors for incomplete fields', () => {
        expect(validate('', '10:00')).toBeNull();
        expect(validate('2026-11-16', '')).toBeNull();
    });

    it('does not report past-date errors for malformed times', () => {
        expect(validate('2026-11-16', '25:00')).toBeNull();
    });

    it('revalidates against the current time', () => {
        expect(validate('2026-11-16', '10:45')).toBeNull();

        vi.setSystemTime(new Date(2026, 10, 16, 10, 46));

        expect(validate('2026-11-16', '10:45')).toEqual({
            pastAppointment: true,
        });
    });
});
