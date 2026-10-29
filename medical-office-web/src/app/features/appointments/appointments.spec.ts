
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Appointment, AppointmentStatus } from './appointment.model';
import { AppointmentService } from './appointment.service';
import { Appointments } from './appointments';

import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';

import { Patient } from '../patients/patient.model';
import { Doctor } from '../doctors/doctor.model';

describe('Appointments', () => {
    let fixture: ComponentFixture<Appointments>;
    let component: Appointments;

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
        rowVersion: 'AQIDBAUGBwg=',
    };

    const appointmentServiceMock = {
        getAll: vi.fn(),
    };

    const patientServiceMock = {
        getAll: vi.fn(),
    };

    const doctorServiceMock = {
        getAll: vi.fn(),
    };

    beforeEach(async () => {
        appointmentServiceMock.getAll.mockReset();
        patientServiceMock.getAll.mockReset();
        doctorServiceMock.getAll.mockReset();

        patientServiceMock.getAll.mockReturnValue(of([patient]));
        doctorServiceMock.getAll.mockReturnValue(of([doctor]));

        await TestBed.configureTestingModule({
            imports: [Appointments],
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

        fixture = TestBed.createComponent(Appointments);
        component = fixture.componentInstance;
    });

    it('should load and display appointments', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        expect(appointmentServiceMock.getAll).toHaveBeenCalledOnce();
        expect(patientServiceMock.getAll).toHaveBeenCalledOnce();
        expect(doctorServiceMock.getAll).toHaveBeenCalledOnce();

        expect(component.appointments()).toEqual([appointment]);
        expect(component.isLoading()).toBe(false);

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('John Doe');
        expect(text).toContain('Dr. Jane Smith');
        expect(text).toContain('Scheduled');
    });

    it('should display loading while fetching appointments', () => {
        const response = new Subject<Appointment[]>();

        appointmentServiceMock.getAll.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        expect(component.isLoading()).toBe(true);

        expect(
            fixture.nativeElement.querySelector('app-loading-indicator'),
        ).not.toBeNull();

        expect(fixture.nativeElement.textContent).toContain(
            'Loading appointments...',
        );

        response.complete();
    });

    it('should display an empty state when no appointments exist', () => {
        appointmentServiceMock.getAll.mockReturnValue(of([]));

        fixture.detectChanges();

        expect(component.appointments()).toEqual([]);

        expect(
            fixture.nativeElement.querySelector('app-empty-state'),
        ).not.toBeNull();

        expect(fixture.nativeElement.textContent).toContain(
            'No appointments found',
        );
    });

    it('should resolve patient and doctor names', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        expect(component.getPatientName(patient.id)).toBe(
            'John Doe',
        );

        expect(component.getDoctorName(doctor.id)).toBe(
            'Dr. Jane Smith',
        );
    });

    it('should provide fallback names for missing related records', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        patientServiceMock.getAll.mockReturnValue(of([]));
        doctorServiceMock.getAll.mockReturnValue(of([]));

        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('Unknown patient');
        expect(text).toContain('Unknown doctor');
    });

    it('should display appointment status labels', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        expect(
            component.getStatusLabel(AppointmentStatus.Scheduled),
        ).toBe('Scheduled');

        expect(
            component.getStatusLabel(AppointmentStatus.Completed),
        ).toBe('Completed');

        expect(
            component.getStatusLabel(AppointmentStatus.Cancelled),
        ).toBe('Cancelled');

        expect(
            component.getStatusLabel(AppointmentStatus.NoShow),
        ).toBe('No show');
    });

    it('should link to the appointment details page', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        const link = fixture.nativeElement.querySelector(
            '.details-link',
        ) as HTMLAnchorElement;

        expect(link).not.toBeNull();

        expect(link.getAttribute('href')).toBe(
            `/appointments/${appointment.id}`,
        );
    });

    it('should display an error when loading fails', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 500 }),
            ),
        );

        fixture.detectChanges();

        expect(component.appointments()).toEqual([]);
        expect(component.canRetry()).toBe(true);

        expect(fixture.nativeElement.textContent).toContain(
            'Unable to load appointments',
        );

        expect(
            fixture.nativeElement.querySelector('app-error-message'),
        ).not.toBeNull();
    });

    it('should retry loading after a server error', () => {
        appointmentServiceMock.getAll
            .mockReturnValueOnce(
                throwError(
                    () => new HttpErrorResponse({ status: 500 }),
                ),
            )
            .mockReturnValueOnce(of([appointment]));

        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            'app-error-message button',
        ) as HTMLButtonElement;

        expect(retryButton).not.toBeNull();

        retryButton.click();
        fixture.detectChanges();

        expect(appointmentServiceMock.getAll).toHaveBeenCalledTimes(2);
        expect(component.appointments()).toEqual([appointment]);
        expect(component.errorMessage()).toBeNull();
    });

    it('should not offer retry for forbidden requests', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 403 }),
            ),
        );

        fixture.detectChanges();

        expect(component.canRetry()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'You do not have permission to view appointments.',
        );

        expect(
            fixture.nativeElement.querySelector(
                'app-error-message button',
            ),
        ).toBeNull();
    });

    it('should show an error if doctor loading fails', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        doctorServiceMock.getAll.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 500 }),
            ),
        );

        fixture.detectChanges();

        expect(component.appointments()).toEqual([]);
        expect(component.isLoading()).toBe(false);
        expect(component.canRetry()).toBe(true);

        expect(fixture.nativeElement.textContent).toContain(
            'Unable to load appointments',
        );
    });


    it('should filter appointments by doctor', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.applyFilters();

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({
            doctorId: doctor.id,
        });

        expect(component.appliedFilters()).toEqual({
            doctorId: doctor.id,
        });
    });

    it('should filter appointments by date', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        component.selectedDate.set('2026-10-20');
        component.applyFilters();

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({
            date: '2026-10-20',
        });
    });

    it('should combine doctor and date filters', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.selectedDate.set('2026-10-20');

        component.applyFilters();

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({
            doctorId: doctor.id,
            date: '2026-10-20',
        });

        expect(component.appliedFilters()).toEqual({
            doctorId: doctor.id,
            date: '2026-10-20',
        });
    });

    it('should clear filters and reload all appointments', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.selectedDate.set('2026-10-20');
        component.applyFilters();

        component.clearFilters();

        expect(component.selectedDoctorId()).toBe('');
        expect(component.selectedDate()).toBe('');
        expect(component.appliedFilters()).toEqual({});

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({});
    });

    it('should not reload appointments until filters are applied', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        expect(appointmentServiceMock.getAll).toHaveBeenCalledOnce();

        component.selectedDoctorId.set(doctor.id);
        component.selectedDate.set('2026-10-20');

        expect(appointmentServiceMock.getAll).toHaveBeenCalledOnce();
        expect(component.appliedFilters()).toEqual({});
        expect(component.appointments()).toEqual([appointment]);
    });

    it('should preserve applied filters when retrying after an error', () => {
        appointmentServiceMock.getAll
            .mockReturnValueOnce(of([appointment]))
            .mockReturnValueOnce(
                throwError(
                    () => new HttpErrorResponse({ status: 500 }),
                ),
            )
            .mockReturnValueOnce(of([appointment]));

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.applyFilters();

        expect(component.canRetry()).toBe(true);
        expect(component.appliedFilters()).toEqual({
            doctorId: doctor.id,
        });

        component.loadAppointments();

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({
            doctorId: doctor.id,
        });

        expect(component.errorMessage()).toBeNull();
        expect(component.appointments()).toEqual([appointment]);
    });

    it('should display an empty state when filters return no results', () => {
        appointmentServiceMock.getAll
            .mockReturnValueOnce(of([appointment]))
            .mockReturnValueOnce(of([]));

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.selectedDate.set('2026-10-22');
        component.applyFilters();

        fixture.detectChanges();

        expect(component.appointments()).toEqual([]);

        expect(
            fixture.nativeElement.querySelector('app-empty-state'),
        ).not.toBeNull();

        expect(fixture.nativeElement.textContent).toContain(
            'No appointments found',
        );
    });

    it('should apply doctor and date filters through the UI', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        const doctorSelect = fixture.nativeElement.querySelector(
            '#doctorFilter',
        ) as HTMLSelectElement;

        const dateInput = fixture.nativeElement.querySelector(
            '#dateFilter',
        ) as HTMLInputElement;

        doctorSelect.value = doctor.id;
        doctorSelect.dispatchEvent(new Event('change'));

        dateInput.value = '2026-10-20';
        dateInput.dispatchEvent(new Event('change'));

        fixture.detectChanges();

        // Changing inputs alone should not trigger a new request.
        expect(appointmentServiceMock.getAll).toHaveBeenCalledOnce();

        const applyButton = fixture.nativeElement.querySelector(
            '.apply-filter-button',
        ) as HTMLButtonElement;

        applyButton.click();

        expect(appointmentServiceMock.getAll).toHaveBeenCalledTimes(2);

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({
            doctorId: doctor.id,
            date: '2026-10-20',
        });
    });

    it('should clear applied filters through the UI', () => {
        appointmentServiceMock.getAll.mockReturnValue(
            of([appointment]),
        );

        fixture.detectChanges();

        component.selectedDoctorId.set(doctor.id);
        component.selectedDate.set('2026-10-20');
        component.applyFilters();

        fixture.detectChanges();

        const clearButton = fixture.nativeElement.querySelector(
            '.clear-filter-button',
        ) as HTMLButtonElement;

        clearButton.click();
        fixture.detectChanges();

        expect(component.selectedDoctorId()).toBe('');
        expect(component.selectedDate()).toBe('');
        expect(component.appliedFilters()).toEqual({});

        expect(appointmentServiceMock.getAll).toHaveBeenLastCalledWith({});

        const doctorSelect = fixture.nativeElement.querySelector(
            '#doctorFilter',
        ) as HTMLSelectElement;

        const dateInput = fixture.nativeElement.querySelector(
            '#dateFilter',
        ) as HTMLInputElement;

        expect(doctorSelect.value).toBe('');
        expect(dateInput.value).toBe('');
    });
});
