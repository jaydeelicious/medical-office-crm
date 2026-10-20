
import {
  FormControl,
  FormGroup,
} from '@angular/forms';

import { appointmentTimeValidator } from './appointment-time.validator';

describe('appointmentTimeValidator', () => {
  function createForm(
    date: string,
    startTime: string,
    endTime: string,
  ) {
    return new FormGroup(
      {
        date: new FormControl(date, { nonNullable: true }),
        startTime: new FormControl(startTime, {
          nonNullable: true,
        }),
        endTime: new FormControl(endTime, {
          nonNullable: true,
        }),
      },
      { validators: appointmentTimeValidator },
    );
  }

  it('should accept a valid time range', () => {
    const form = createForm(
      '2026-10-20',
      '09:00',
      '09:30',
    );

    expect(form.hasError('invalidTimeRange')).toBe(false);
    expect(form.valid).toBe(true);
  });

  it('should reject an end time before the start time', () => {
    const form = createForm(
      '2026-10-20',
      '10:00',
      '09:30',
    );

    expect(form.hasError('invalidTimeRange')).toBe(true);
  });

  it('should reject equal start and end times', () => {
    const form = createForm(
      '2026-10-20',
      '09:00',
      '09:00',
    );

    expect(form.hasError('invalidTimeRange')).toBe(true);
  });

  it('should accept a one-minute appointment', () => {
    const form = createForm(
      '2026-10-20',
      '09:00',
      '09:01',
    );

    expect(form.valid).toBe(true);
  });

  it('should accept a late-night appointment', () => {
    const form = createForm(
      '2026-10-20',
      '23:00',
      '23:59',
    );

    expect(form.valid).toBe(true);
  });

  it('should reject an overnight time range', () => {
    const form = createForm(
      '2026-10-20',
      '23:30',
      '00:30',
    );

    expect(form.hasError('invalidTimeRange')).toBe(true);
  });

  it('should skip cross-field validation when date is missing', () => {
    const form = createForm(
      '',
      '09:00',
      '09:30',
    );

    expect(form.hasError('invalidTimeRange')).toBe(false);
  });

  it('should skip cross-field validation when start time is missing', () => {
    const form = createForm(
      '2026-10-20',
      '',
      '09:30',
    );

    expect(form.hasError('invalidTimeRange')).toBe(false);
  });

  it('should skip cross-field validation when end time is missing', () => {
    const form = createForm(
      '2026-10-20',
      '09:00',
      '',
    );

    expect(form.hasError('invalidTimeRange')).toBe(false);
  });

  it('should revalidate when appointment times change', () => {
    const form = createForm(
      '2026-10-20',
      '10:00',
      '09:30',
    );

    expect(form.invalid).toBe(true);

    form.controls.endTime.setValue('10:30');

    expect(form.valid).toBe(true);

    form.controls.startTime.setValue('11:00');

    expect(form.hasError('invalidTimeRange')).toBe(true);
  });
});
