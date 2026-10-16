
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  Appointment,
  AppointmentStatus,
} from '../appointment.model';
import { AppointmentService } from '../appointment.service';
import { AppointmentDetails } from './appointment-details';

import { Patient } from '../../patients/patient.model';
import { PatientService } from '../../patients/patient.service';
import { Doctor } from '../../doctors/doctor.model';
import { DoctorService } from '../../doctors/doctor.service';

describe('AppointmentDetails', () => {
  let fixture: ComponentFixture<AppointmentDetails>;
  let component: AppointmentDetails;

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
    getById: vi.fn(),
  };

  const patientServiceMock = {
    getById: vi.fn(),
  };

  const doctorServiceMock = {
    getById: vi.fn(),
  };

  // Allows us to simulate missing route parameters.
  let routeId: string | null;

  beforeEach(async () => {
    appointmentServiceMock.getById.mockReset();
    patientServiceMock.getById.mockReset();
    doctorServiceMock.getById.mockReset();

    routeId = appointment.id;

    patientServiceMock.getById.mockReturnValue(of(patient));
    doctorServiceMock.getById.mockReturnValue(of(doctor));

    await TestBed.configureTestingModule({
      imports: [AppointmentDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get paramMap() {
                return convertToParamMap(
                  routeId ? { id: routeId } : {},
                );
              },
            },
          },
        },
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

    fixture = TestBed.createComponent(AppointmentDetails);
    component = fixture.componentInstance;
  });

  it('should load and display appointment details', () => {
    appointmentServiceMock.getById.mockReturnValue(
      of(appointment),
    );

    fixture.detectChanges();

    expect(appointmentServiceMock.getById)
      .toHaveBeenCalledWith(appointment.id);

    expect(patientServiceMock.getById)
      .toHaveBeenCalledWith(patient.id);

    expect(doctorServiceMock.getById)
      .toHaveBeenCalledWith(doctor.id);

    expect(component.appointment()).toEqual(appointment);
    expect(component.isLoading()).toBe(false);

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('John Doe');
    expect(text).toContain('Dr. Jane Smith');
    expect(text).toContain('Scheduled');
    expect(text).toContain('Follow-up consultation');
  });

  it('should display loading while fetching details', () => {
    const response = new Subject<Appointment>();

    appointmentServiceMock.getById.mockReturnValue(
      response.asObservable(),
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);

    expect(
      fixture.nativeElement.querySelector('app-loading-indicator'),
    ).not.toBeNull();

    expect(fixture.nativeElement.textContent).toContain(
      'Loading appointment details...',
    );

    response.complete();
  });

  it('should display the correct patient and doctor names', () => {
    appointmentServiceMock.getById.mockReturnValue(
      of(appointment),
    );

    fixture.detectChanges();

    expect(component.patientName()).toBe('John Doe');
    expect(component.doctorName()).toBe('Dr. Jane Smith');
  });

  it('should display a fallback when notes are null', () => {
    appointmentServiceMock.getById.mockReturnValue(
      of({ ...appointment, notes: null }),
    );

    fixture.detectChanges();

    const notes = fixture.nativeElement.querySelector(
      '.notes',
    ) as HTMLElement;

    expect(notes.textContent?.trim()).toBe('—');
  });

  it('should display an error when the appointment ID is missing', () => {
    routeId = null;

    fixture.detectChanges();

    expect(appointmentServiceMock.getById).not.toHaveBeenCalled();
    expect(component.appointment()).toBeNull();
    expect(component.isLoading()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'No appointment ID was provided.',
    );
  });

  it('should display an error when the appointment is not found', () => {
    appointmentServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404 }),
      ),
    );

    fixture.detectChanges();

    expect(component.appointment()).toBeNull();
    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'could not be found',
    );
  });

  it('should display an error when related patient loading fails', () => {
    appointmentServiceMock.getById.mockReturnValue(
      of(appointment),
    );

    patientServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404 }),
      ),
    );

    fixture.detectChanges();

    expect(component.appointment()).toBeNull();
    expect(component.errorMessage()).toContain(
      'related records could not be found',
    );
  });

  it('should retry after a server error', () => {
    appointmentServiceMock.getById
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 500 }),
        ),
      )
      .mockReturnValueOnce(of(appointment));

    fixture.detectChanges();

    expect(component.canRetry()).toBe(true);

    const retryButton = fixture.nativeElement.querySelector(
      'app-error-message button',
    ) as HTMLButtonElement;

    expect(retryButton).not.toBeNull();

    retryButton.click();
    fixture.detectChanges();

    expect(appointmentServiceMock.getById)
      .toHaveBeenCalledTimes(2);

    expect(component.appointment()).toEqual(appointment);
    expect(component.errorMessage()).toBeNull();
  });

  it('should not offer retry for forbidden requests', () => {
    appointmentServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403 }),
      ),
    );

    fixture.detectChanges();

    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'You do not have permission to view this appointment.',
    );

    expect(
      fixture.nativeElement.querySelector(
        'app-error-message button',
      ),
    ).toBeNull();
  });

  it('should link back to the appointment listing', () => {
    appointmentServiceMock.getById.mockReturnValue(
      of(appointment),
    );

    fixture.detectChanges();

    const backLink = fixture.nativeElement.querySelector(
      '.back-link',
    ) as HTMLAnchorElement;

    expect(backLink.getAttribute('href')).toBe('/appointments');
  });
});
