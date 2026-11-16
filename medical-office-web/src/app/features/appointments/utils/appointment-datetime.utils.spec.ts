
import { describe, expect, it } from 'vitest';

import {
    calculateDuration,
    calculateEndTime,
    getLocalToday,
    minutesToTime,
    timeToMinutes,
} from './appointment-datetime.utils';

describe('Appointment date/time utilities', () => {
    describe('getLocalToday', () => {
        it('returns the current local calendar date', () => {
            const now = new Date();

            const expected = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0'),
            ].join('-');

            expect(getLocalToday()).toBe(expected);
        });
    });

    describe('timeToMinutes', () => {
        it.each([
            ['00:00', 0],
            ['09:30', 570],
            ['14:15', 855],
            ['23:59', 1439],
        ])('converts %s to %i minutes', (time, expected) => {
            expect(timeToMinutes(time)).toBe(expected);
        });

        it.each([
            '',
            '24:00',
            '12:60',
            '9:30',
            'invalid',
        ])('rejects invalid time %s', time => {
            expect(timeToMinutes(time)).toBeNull();
        });
    });

    describe('minutesToTime', () => {
        it('converts minutes to HH:mm', () => {
            expect(minutesToTime(570)).toBe('09:30');
            expect(minutesToTime(855)).toBe('14:15');
            expect(minutesToTime(1439)).toBe('23:59');
        });
    });

    describe('calculateEndTime', () => {
        it.each([
            ['10:00', 30, '10:30'],
            ['10:00', 35, '10:35'],
            ['10:00', 60, '11:00'],
            ['14:15', 45, '15:00'],
            ['23:00', 45, '23:45'],
        ])(
            'calculates %s + %i minutes as %s',
            (start, duration, expected) => {
                expect(calculateEndTime(start, duration)).toBe(expected);
            },
        );

        it('rejects appointments crossing midnight', () => {
            expect(calculateEndTime('23:30', 60)).toBeNull();
        });

        it('rejects appointments ending exactly at midnight', () => {
            expect(calculateEndTime('23:30', 30)).toBeNull();
        });

        it.each([0, -10, 1.5, Number.NaN])(
            'rejects invalid duration %s',
            duration => {
                expect(calculateEndTime('10:00', duration)).toBeNull();
            },
        );

        it('rejects invalid start times', () => {
            expect(calculateEndTime('25:00', 30)).toBeNull();
        });
    });

    describe('calculateDuration', () => {
        it.each([
            ['09:00', '09:30', 30],
            ['10:00', '11:00', 60],
            ['14:15', '15:00', 45],
        ])(
            'calculates duration between %s and %s',
            (start, end, expected) => {
                expect(calculateDuration(start, end)).toBe(expected);
            },
        );

        it('rejects equal start and end times', () => {
            expect(calculateDuration('10:00', '10:00')).toBeNull();
        });

        it('rejects reversed time ranges', () => {
            expect(calculateDuration('11:00', '10:00')).toBeNull();
        });
    });
});
