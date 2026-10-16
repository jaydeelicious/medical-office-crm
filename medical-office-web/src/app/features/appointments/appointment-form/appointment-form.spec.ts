
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  Appointment,
  AppointmentStatus,
} from '../appointment.model';
import { AppointmentService } from '../appointment.service';
import { AppointmentForm } from './appointment-form';

import { Patient } from '../../patients/patient.model';
import { PatientService } from '../../patients/patient.service';
import { Doctor } from '../../doctors/doctor.model';
import { DoctorService } from '../../doctors/doctor.service';

describe('AppointmentForm', () => {
  let fixture: ComponentFixture<AppointmentForm>;
  let component: AppointmentForm;
  let router: Router;

  const patient: Patient = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    email: 'john@example.com',
    dateOfBirth: '1990-05-21',
  };

  const doctor: Doctor = {
    id: 'b1234567-b491-4e62-8519-d1f197c1a12e',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: null,
    email: 'jane@example.com',
    specialty: 'Cardiology',
  };

  const appointment: Appointment = {
    id: 'a1234567-b491-4e62-8519-d1f197c1a12e',
    patientId: patient.id,
    doctorId: doctor.id,
    startTime: '2026-10-20T09:00:00',
    endTime: '2026-10-20T09:30:00',
    status: AppointmentStatus.Scheduled,
    notes: 'Follow-up consultation',
  };

  const appointmentServiceMock = {
    create: vi.fn(),
  };

  const patientServiceMock = {
    getAll: vi.fn(),
  };

  const doctorServiceMock = {
    getAll: vi.fn(),
  };

  function fillValidForm(): void {
    component.form.patchValue({
      patientId: patient.id,
      doctorId: doctor.id,
      date: '2026-10-20',
      startTime: '09:00',
      endTime: '09:30',
      notes: 'Follow-up consultation',
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();

    patientServiceMock.getAll.mockReturnValue(of([patient]));
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    await TestBed.configureTestingModule({
      imports: [AppointmentForm],
      providers: [
        provideRouter([]),
        {
          provide: AppointmentService,
          useValue: appointmentServiceMock,
        },
        {
          provide: PatientService,
          useValue: patientServiceMock,
        },
        {
          provide: DoctorService,
          useValue: doctorServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentForm);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should start with an invalid empty form', () => {
    fixture.detectChanges();

    expect(component.form.invalid).toBe(true);
    expect(component.patientId.hasError('required')).toBe(true);
    expect(component.doctorId.hasError('required')).toBe(true);
    expect(component.date.hasError('required')).toBe(true);
    expect(component.startTime.hasError('required')).toBe(true);
    expect(component.endTime.hasError('required')).toBe(true);
  });

  it('should load patient and doctor options', () => {
    fixture.detectChanges();

    expect(patientServiceMock.getAll).toHaveBeenCalledOnce();
    expect(doctorServiceMock.getAll).toHaveBeenCalledOnce();

    expect(component.patients()).toEqual([patient]);
    expect(component.doctors()).toEqual([doctor]);

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('John Doe');
    expect(text).toContain('Dr. Jane Smith');
  });

  it('should display loading while fetching options', () => {
    const patientsResponse = new Subject<Patient[]>();

    patientServiceMock.getAll.mockReturnValue(
      patientsResponse.asObservable(),
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);

    expect(
      fixture.nativeElement.querySelector('app-loading-indicator'),
    ).not.toBeNull();

    patientsResponse.complete();
  });

  it('should allow retry when loading options fails', () => {
    patientServiceMock.getAll
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 500 }),
        ),
      )
      .mockReturnValueOnce(of([patient]));

    fixture.detectChanges();

    expect(component.canRetry()).toBe(true);

    const retryButton = fixture.nativeElement.querySelector(
      'app-error-message button',
    ) as HTMLButtonElement;

    retryButton.click();
    fixture.detectChanges();

    expect(patientServiceMock.getAll).toHaveBeenCalledTimes(2);
    expect(component.errorMessage()).toBeNull();
    expect(component.patients()).toEqual([patient]);
  });

  it('should reject an end time earlier than start time', () => {
    fixture.detectChanges();
    fillValidForm();

    component.endTime.setValue('08:30');

    expect(component.form.hasError('invalidTimeRange')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('should reject an end time equal to start time', () => {
    fixture.detectChanges();
    fillValidForm();

    component.endTime.setValue('09:00');

    expect(component.form.hasError('invalidTimeRange')).toBe(true);
  });

  it('should reject notes longer than 1000 characters', () => {
    fixture.detectChanges();
    fillValidForm();

    component.notes.setValue('A'.repeat(1001));

    expect(component.notes.hasError('maxlength')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('should not submit an invalid form', () => {
    fixture.detectChanges();

    component.onSubmit();

    expect(appointmentServiceMock.create).not.toHaveBeenCalled();
    expect(component.patientId.touched).toBe(true);
    expect(component.doctorId.touched).toBe(true);
  });

  it('should create an appointment and navigate to its details', () => {
    appointmentServiceMock.create.mockReturnValue(
      of(appointment),
    );

    fixture.detectChanges();
    fillValidForm();

    component.onSubmit();

    expect(appointmentServiceMock.create).toHaveBeenCalledWith({
      patientId: patient.id,
      doctorId: doctor.id,
      startTime: '2026-10-20T09:00:00',
      endTime: '2026-10-20T09:30:00',
      notes: 'Follow-up consultation',
    });

    expect(router.navigate).toHaveBeenCalledWith([
      '/appointments',
      appointment.id,
    ]);

    expect(component.isSubmitting()).toBe(false);
  });

  it('should convert blank notes to null', () => {
    appointmentServiceMock.create.mockReturnValue(
      of(appointment),
    );

    fixture.detectChanges();
    fillValidForm();

    component.notes.setValue('   ');
    component.onSubmit();

    expect(appointmentServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: null,
      }),
    );
  });

  it('should prevent duplicate submissions', () => {
    const response = new Subject<Appointment>();

    appointmentServiceMock.create.mockReturnValue(
      response.asObservable(),
    );

    fixture.detectChanges();
    fillValidForm();

    component.onSubmit();
    component.onSubmit();

    expect(appointmentServiceMock.create).toHaveBeenCalledOnce();
    expect(component.isSubmitting()).toBe(true);

    response.next(appointment);
    response.complete();

    expect(component.isSubmitting()).toBe(false);
  });

  it('should handle appointment overlap conflicts', () => {
    appointmentServiceMock.create.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409 }),
      ),
    );

    fixture.detectChanges();
    fillValidForm();

    component.onSubmit();
    fixture.detectChanges();

    expect(component.submitError()).toContain(
      'already has an appointment',
    );

    expect(component.isSubmitting()).toBe(false);
    expect(component.form.getRawValue().doctorId).toBe(doctor.id);
  });

  it('should display backend validation errors', () => {
    appointmentServiceMock.create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              errors: {
                StartTime: [
                  'Start time must be earlier than end time',
                ],
              },
            },
          }),
      ),
    );

    fixture.detectChanges();
    fillValidForm();

    component.onSubmit();
    fixture.detectChanges();

    expect(component.validationErrors()).toContain(
      'Start time must be earlier than end time',
    );

    expect(fixture.nativeElement.textContent).toContain(
      'Start time must be earlier than end time',
    );
  });

  it('should prevent scheduling without available patients', () => {
    patientServiceMock.getAll.mockReturnValue(of([]));

    fixture.detectChanges();
    fillValidForm();

    component.onSubmit();

    expect(appointmentServiceMock.create).not.toHaveBeenCalled();
    expect(component.submitError()).toContain(
      'A patient and doctor must be available',
    );
  });

  it('should cancel without scheduling', () => {
    fixture.detectChanges();

    component.cancel();

    expect(router.navigate).toHaveBeenCalledWith([
      '/appointments',
    ]);

    expect(appointmentServiceMock.create).not.toHaveBeenCalled();
  });
});
