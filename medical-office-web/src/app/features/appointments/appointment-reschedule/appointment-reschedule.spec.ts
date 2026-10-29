
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    ActivatedRoute,
    convertToParamMap,
    provideRouter,
    Router,
} from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
    Appointment,
    AppointmentStatus,
} from '../appointment.model';
import { AppointmentService } from '../appointment.service';
import { AppointmentReschedule } from './appointment-reschedule';

describe('AppointmentReschedule', () => {
    let fixture: ComponentFixture<AppointmentReschedule>;
    let component: AppointmentReschedule;
    let router: Router;

    const appointment: Appointment = {
        id: 'a1234567-b491-4e62-8519-d1f197c1a12e',
        patientId: 'b1234567-b491-4e62-8519-d1f197c1a12e',
        doctorId: 'c1234567-b491-4e62-8519-d1f197c1a12e',
        startTime: '2026-10-20T09:00:00',
        endTime: '2026-10-20T09:30:00',
        status: AppointmentStatus.Scheduled,
        notes: 'Follow-up consultation',
        rowVersion: 'AQIDBAUGBwg=',
    };

    const appointmentServiceMock = {
        getById: vi.fn(),
        reschedule: vi.fn(),
    };

    let routeId: string | null;

    beforeEach(async () => {
        vi.resetAllMocks();
        routeId = appointment.id;

        await TestBed.configureTestingModule({
            imports: [AppointmentReschedule],
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
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AppointmentReschedule);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);

        vi.spyOn(router, 'navigate').mockResolvedValue(true);
    });

    it('should load and prepopulate the current appointment', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        expect(appointmentServiceMock.getById)
            .toHaveBeenCalledWith(appointment.id);

        expect(component.appointment()).toEqual(appointment);
        expect(component.form.getRawValue()).toEqual({
            date: '2026-10-20',
            startTime: '09:00',
            endTime: '09:30',
        });

        expect(component.isLoading()).toBe(false);
    });

    it('should display loading while fetching the appointment', () => {
        const response = new Subject<Appointment>();

        appointmentServiceMock.getById.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        expect(component.isLoading()).toBe(true);

        expect(
            fixture.nativeElement.querySelector('app-loading-indicator'),
        ).not.toBeNull();

        response.complete();
    });

    it('should reject an end time earlier than the start time', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.endTime.setValue('08:30');

        expect(component.form.hasError('invalidTimeRange')).toBe(true);
        expect(component.form.invalid).toBe(true);
    });

    it('should reject equal start and end times', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.endTime.setValue('09:00');

        expect(component.form.hasError('invalidTimeRange')).toBe(true);
    });

    it('should not submit an invalid form', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.endTime.setValue('08:00');
        component.onSubmit();

        expect(appointmentServiceMock.reschedule)
            .not.toHaveBeenCalled();

        expect(component.form.touched).toBe(true);
    });

    it('should reschedule and navigate to appointment details', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));
        appointmentServiceMock.reschedule.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.form.patchValue({
            date: '2026-10-21',
            startTime: '10:00',
            endTime: '10:30',
        });

        component.onSubmit();

        expect(appointmentServiceMock.reschedule).toHaveBeenCalledWith(
            appointment.id,
            {
                startTime: '2026-10-21T10:00:00',
                endTime: '2026-10-21T10:30:00',
                rowVersion: appointment.rowVersion,
            },
        );

        expect(router.navigate).toHaveBeenCalledWith([
            '/appointments',
            appointment.id,
        ]);

        expect(component.isSubmitting()).toBe(false);
    });

    it('should prevent duplicate submissions', () => {
        const response = new Subject<void>();

        appointmentServiceMock.getById.mockReturnValue(of(appointment));
        appointmentServiceMock.reschedule.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.onSubmit();
        component.onSubmit();

        expect(appointmentServiceMock.reschedule)
            .toHaveBeenCalledOnce();

        expect(component.isSubmitting()).toBe(true);

        response.next();
        response.complete();

        expect(component.isSubmitting()).toBe(false);
    });

    it('should handle appointment overlap conflicts', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        appointmentServiceMock.reschedule.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 409 }),
            ),
        );

        fixture.detectChanges();

        component.form.patchValue({
            startTime: '10:00',
            endTime: '10:30',
        });

        component.onSubmit();
        fixture.detectChanges();

        expect(component.submitError()).toContain(
            'already has an appointment',
        );

        expect(component.isSubmitting()).toBe(false);
        expect(component.form.controls.startTime.value).toBe('10:00');
    });

    it('should display backend validation errors', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        appointmentServiceMock.reschedule.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({
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
        component.onSubmit();
        fixture.detectChanges();

        expect(component.validationErrors()).toContain(
            'Start time must be earlier than end time',
        );

        expect(fixture.nativeElement.textContent).toContain(
            'Start time must be earlier than end time',
        );
    });

    it('should display an error for a missing appointment ID', () => {
        routeId = null;

        fixture.detectChanges();

        expect(appointmentServiceMock.getById)
            .not.toHaveBeenCalled();

        expect(component.appointment()).toBeNull();
        expect(component.errorMessage()).toContain(
            'No appointment ID was provided',
        );
    });

    it('should handle an appointment that no longer exists', () => {
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

    it('should allow retry after a server error', () => {
        appointmentServiceMock.getById
            .mockReturnValueOnce(
                throwError(
                    () => new HttpErrorResponse({ status: 500 }),
                ),
            )
            .mockReturnValueOnce(of(appointment));

        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            'app-error-message button',
        ) as HTMLButtonElement;

        retryButton.click();
        fixture.detectChanges();

        expect(appointmentServiceMock.getById)
            .toHaveBeenCalledTimes(2);

        expect(component.appointment()).toEqual(appointment);
        expect(component.errorMessage()).toBeNull();
    });

    it('should cancel and return to appointment details', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));

        fixture.detectChanges();

        component.cancel();

        expect(router.navigate).toHaveBeenCalledWith([
            '/appointments',
            appointment.id,
        ]);

        expect(appointmentServiceMock.reschedule)
            .not.toHaveBeenCalled();
    });

    it('should not cancel while submitting', () => {
        const response = new Subject<void>();

        appointmentServiceMock.getById.mockReturnValue(of(appointment));
        appointmentServiceMock.reschedule.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.onSubmit();
        component.cancel();

        expect(router.navigate).not.toHaveBeenCalled();
        expect(component.isSubmitting()).toBe(true);

        response.complete();
    });

    it('should preserve local office time when rescheduling late at night', () => {
        appointmentServiceMock.getById.mockReturnValue(of(appointment));
        appointmentServiceMock.reschedule.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.form.patchValue({
            date: '2026-10-21',
            startTime: '23:00',
            endTime: '23:45',
        });

        component.onSubmit();

        expect(appointmentServiceMock.reschedule).toHaveBeenCalledWith(
            appointment.id,
            {
                startTime: '2026-10-21T23:00:00',
                endTime: '2026-10-21T23:45:00',
                rowVersion: appointment.rowVersion,
            },
        );
    });

});
