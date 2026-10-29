
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { 
    ActivatedRoute, 
    Router,
    provideRouter
} from '@angular/router';
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
        rowVersion: 'AQIDBAUGBwg=',
    };

    const updatedAppointment: Appointment = {
        ...appointment,
        status: AppointmentStatus.Completed,
        rowVersion: 'CAcGBQQDAgE=',
    }

    const appointmentServiceMock = {
        getById: vi.fn(),
        updateStatus: vi.fn(),
        delete: vi.fn(),
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
        appointmentServiceMock.updateStatus.mockReset();
        appointmentServiceMock.delete.mockReset();

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

        const router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
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


    it('should link to the appointment rescheduling page', () => {
        appointmentServiceMock.getById.mockReturnValue(
            of(appointment),
        );

        fixture.detectChanges();

        const link = fixture.nativeElement.querySelector(
            '.reschedule-button',
        ) as HTMLAnchorElement;

        expect(link).not.toBeNull();

        expect(link.getAttribute('href')).toBe(
            `/appointments/${appointment.id}/reschedule`,
        );
    });


    it('should initialize the selected status from the appointment', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        expect(component.selectedStatus()).toBe(
            AppointmentStatus.Scheduled,
        );

        expect(component.isUpdatingStatus()).toBe(false);
    });

    it('should update appointment status successfully', () => {
        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(updatedAppointment));

        appointmentServiceMock.updateStatus.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);
        component.updateStatus();

        expect(appointmentServiceMock.updateStatus).toHaveBeenCalledWith(
            appointment.id,
            {
                status: AppointmentStatus.Completed,
                rowVersion: appointment.rowVersion,
            },
        );

        expect(appointmentServiceMock.getById).toHaveBeenCalledTimes(2);
        expect(component.appointment()).toEqual(updatedAppointment);
        expect(component.selectedStatus()).toBe(AppointmentStatus.Completed);
        expect(component.isUpdatingStatus()).toBe(false);
        expect(component.statusError()).toBeNull();
    });

    it('should allow changing a cancelled appointment back to scheduled', () => {
        const cancelledAppointment: Appointment = {
            ...appointment,
            status: AppointmentStatus.Cancelled,
        };

        const reactivatedAppointment: Appointment = {
            ...cancelledAppointment,
            status: AppointmentStatus.Scheduled,
            rowVersion: 'CAcGBQQDAgE=',
        };

        appointmentServiceMock.getById
            .mockReturnValueOnce(of(cancelledAppointment))
            .mockReturnValueOnce(of(reactivatedAppointment));

        appointmentServiceMock.updateStatus.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Scheduled);
        component.updateStatus();

        expect(appointmentServiceMock.updateStatus).toHaveBeenCalledWith(
            appointment.id,
            {
                status: AppointmentStatus.Scheduled,
                rowVersion: cancelledAppointment.rowVersion,
            },
        );

        expect(component.appointment()).toEqual(reactivatedAppointment);
        expect(component.selectedStatus()).toBe(AppointmentStatus.Scheduled);
    });

    it('should not update when the selected status is unchanged', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.updateStatus();

        expect(appointmentServiceMock.updateStatus).not.toHaveBeenCalled();
    });

    it('should prevent duplicate status update requests', () => {
        const response = new Subject<void>();

        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(updatedAppointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);

        component.updateStatus();
        component.updateStatus();

        expect(appointmentServiceMock.updateStatus).toHaveBeenCalledOnce();
        expect(component.isUpdatingStatus()).toBe(true);

        response.next();
        response.complete();

        expect(component.isUpdatingStatus()).toBe(false);
        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Completed,
        );
    });

    it('should preserve the original status when updating fails', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 500 }),
            ),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);
        component.updateStatus();
        fixture.detectChanges();

        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Scheduled,
        );

        expect(component.selectedStatus()).toBe(
            AppointmentStatus.Scheduled,
        );

        expect(component.statusError()).toContain(
            'Unable to update appointment status',
        );

        expect(component.isUpdatingStatus()).toBe(false);
    });

    it('should handle forbidden status updates', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 403 }),
            ),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Cancelled);
        component.updateStatus();

        expect(component.statusError()).toContain(
            'You do not have permission',
        );

        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Scheduled,
        );
    });

    it('should disable the update button while saving', () => {
        const response = new Subject<void>();

        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(updatedAppointment));
        appointmentServiceMock.updateStatus.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);
        component.updateStatus();
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector(
            '.save-status-button',
        ) as HTMLButtonElement;

        expect(button.disabled).toBe(true);
        expect(button.textContent).toContain('Saving...');

        response.next();
        response.complete();

        fixture.detectChanges();

        expect(button.disabled).toBe(true);
        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Completed,
        );
    });

    it('should update appointment status using the dropdown and button', () => {
        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(updatedAppointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            of(void 0),
        );

        fixture.detectChanges();

        const select = fixture.nativeElement.querySelector(
            '#appointmentStatus',
        ) as HTMLSelectElement;

        const updateButton = fixture.nativeElement.querySelector(
            '.save-status-button',
        ) as HTMLButtonElement;

        expect(updateButton.disabled).toBe(true);

        // ngValue preserves the numeric enum values.
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change'));

        fixture.detectChanges();

        expect(component.selectedStatus()).toBe(
            AppointmentStatus.Completed,
        );

        expect(updateButton.disabled).toBe(false);

        updateButton.click();
        fixture.detectChanges();

        expect(appointmentServiceMock.updateStatus).toHaveBeenCalledWith(
            appointment.id,
            { 
                status: AppointmentStatus.Completed,
                rowVersion: appointment.rowVersion
            },
        );

        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Completed,
        );

        // The displayed status should reflect the saved value.
        expect(fixture.nativeElement.textContent).toContain('Completed');
        expect(updateButton.disabled).toBe(true);
    });

    it('should display a conflict when the appointment was modified elsewhere', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 409 })),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);
        component.updateStatus();
        fixture.detectChanges();

        expect(component.hasStatusConflict()).toBe(true);
        expect(component.statusError()).toContain(
            'modified by another user',
        );

        expect(component.appointment()?.status).toBe(
            AppointmentStatus.Scheduled,
        );

        expect(component.selectedStatus()).toBe(
            AppointmentStatus.Scheduled,
        );

        const refreshButton = fixture.nativeElement.querySelector(
            '.status-error button',
        ) as HTMLButtonElement;

        expect(refreshButton).not.toBeNull();
        expect(refreshButton.textContent).toContain('Refresh appointment');

        const updateButton = fixture.nativeElement.querySelector(
            '.status-controls .save-status-button',
        ) as HTMLButtonElement;

        expect(updateButton.disabled).toBe(true);
    });

    it('should refresh the appointment after a concurrency conflict', () => {
        const serverAppointment: Appointment = {
            ...appointment,
            status: AppointmentStatus.Cancelled,
            rowVersion: 'CAcGBQQDAgE=',
        };

        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(serverAppointment));

        appointmentServiceMock.updateStatus.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 409 })),
        );

        fixture.detectChanges();

        component.selectedStatus.set(AppointmentStatus.Completed);
        component.updateStatus();
        fixture.detectChanges();

        expect(component.hasStatusConflict()).toBe(true);

        const refreshButton = fixture.nativeElement.querySelector(
            '.status-error button',
        ) as HTMLButtonElement;

        refreshButton.click();
        fixture.detectChanges();

        expect(appointmentServiceMock.getById).toHaveBeenCalledTimes(2);
        expect(component.appointment()).toEqual(serverAppointment);
        expect(component.selectedStatus()).toBe(AppointmentStatus.Cancelled);
        expect(component.hasStatusConflict()).toBe(false);
        expect(component.statusError()).toBeNull();
    });

    it('should open and cancel appointment deletion', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.requestDelete();

        expect(component.showDeleteConfirmation()).toBe(true);
        expect(appointmentServiceMock.delete).not.toHaveBeenCalled();

        component.cancelDelete();

        expect(component.showDeleteConfirmation()).toBe(false);
        expect(appointmentServiceMock.delete).not.toHaveBeenCalled();
    });

    it('should delete using the current RowVersion', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));
        appointmentServiceMock.delete.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.requestDelete();
        component.confirmDelete();

        const router = TestBed.inject(Router);

        expect(router.navigate).toHaveBeenCalledWith([
            '/appointments',
        ]);

        expect(appointmentServiceMock.delete).toHaveBeenCalledWith(
            appointment.id,
            appointment.rowVersion,
        );

        expect(component.showDeleteConfirmation()).toBe(false);
        expect(component.isDeleting()).toBe(false);
    });

    it('should reject stale deletion and require a refresh', () => {
        const latestAppointment: Appointment = {
            ...appointment,
            rowVersion: 'CAcGBQQDAgE=',
        };

        appointmentServiceMock.getById
            .mockReturnValueOnce(of(appointment))
            .mockReturnValueOnce(of(latestAppointment));

        appointmentServiceMock.delete.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 409 })),
        );

        fixture.detectChanges();

        component.requestDelete();
        component.confirmDelete();
        fixture.detectChanges();

        expect(component.hasDeleteConflict()).toBe(true);
        expect(component.deleteError()).toContain(
            'modified by another user',
        );

        expect(component.showDeleteConfirmation()).toBe(false);
        expect(appointmentServiceMock.delete).toHaveBeenCalledOnce();

        // A second deletion must not be submitted with the stale token.
        component.requestDelete();
        component.confirmDelete();

        expect(appointmentServiceMock.delete).toHaveBeenCalledOnce();

        // Refresh to obtain the latest appointment and version.
        component.loadAppointment();

        expect(component.appointment()).toEqual(latestAppointment);
        expect(component.hasDeleteConflict()).toBe(false);
        expect(component.deleteError()).toBeNull();

        component.requestDelete();

        expect(component.showDeleteConfirmation()).toBe(true);
    });

});
