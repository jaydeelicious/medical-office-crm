
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
    Appointment,
    RescheduleAppointmentRequest,
} from '../appointment.model';
import { AppointmentService } from '../appointment.service';

import { appointmentTimeValidator } from '../validators/appointment-time.validator';

import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

@Component({
    selector: 'app-appointment-reschedule',
    imports: [
        DatePipe,
        RouterLink,
        ReactiveFormsModule,
        LoadingIndicator,
        ErrorMessage,
    ],
    templateUrl: './appointment-reschedule.html',
    styleUrl: './appointment-reschedule.scss',
})
export class AppointmentReschedule implements OnInit {
    private readonly fb = inject(FormBuilder).nonNullable;
    private readonly appointmentService = inject(AppointmentService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);

    readonly appointment = signal<Appointment | null>(null);
    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly canRetry = signal(false);
    readonly isSubmitting = signal(false);
    readonly submitError = signal<string | null>(null);
    readonly validationErrors = signal<string[]>([]);

    readonly form = this.fb.group(
        {
            date: ['', Validators.required],
            startTime: ['', Validators.required],
            endTime: ['', Validators.required],
        },
        {
            validators: appointmentTimeValidator,
        },
    );

    get date() {
        return this.form.controls.date;
    }

    get startTime() {
        return this.form.controls.startTime;
    }

    get endTime() {
        return this.form.controls.endTime;
    }

    ngOnInit(): void {
        this.loadAppointment();
    }

    loadAppointment(): void {
        const id = this.route.snapshot.paramMap.get('id');

        if (!id) {
            this.appointment.set(null);
            this.errorMessage.set('No appointment ID was provided.');
            this.canRetry.set(false);
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.canRetry.set(false);
        this.appointment.set(null);
        this.submitError.set(null);
        this.validationErrors.set([]);

        this.appointmentService
            .getById(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (appointment) => {
                    this.appointment.set(appointment);

                    // Preserve local office time without UTC conversion.
                    this.form.patchValue({
                        date: appointment.startTime.slice(0, 10),
                        startTime: appointment.startTime.slice(11, 16),
                        endTime: appointment.endTime.slice(11, 16),
                    });

                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.errorMessage.set(this.getErrorMessage(error));
                    this.canRetry.set(this.isRetryable(error));
                    this.isLoading.set(false);
                },
            });
    }

    onSubmit(): void {
        const appointment = this.appointment();

        if (
            !appointment ||
            this.isLoading() ||
            this.isSubmitting()
        ) {
            return;
        }

        this.form.markAllAsTouched();

        if (this.form.invalid) {
            return;
        }

        const values = this.form.getRawValue();

        const request: RescheduleAppointmentRequest = {
            startTime: `${values.date}T${values.startTime}:00`,
            endTime: `${values.date}T${values.endTime}:00`
        };

        this.isSubmitting.set(true);
        this.submitError.set(null);
        this.validationErrors.set([]);

        this.appointmentService
            .reschedule(appointment.id, request)
            .pipe(
                finalize(() => this.isSubmitting.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    void this.router.navigate([
                        '/appointments',
                        appointment.id,
                    ]);
                },
                error: (error: unknown) => {
                    this.handleSubmitError(error);
                },
            });
    }

    cancel(): void {
        if (this.isSubmitting()) {
            return;
        }

        const appointment = this.appointment();

        if (appointment) {
            void this.router.navigate([
                '/appointments',
                appointment.id,
            ]);
            return;
        }

        void this.router.navigate(['/appointments']);
    }


    private handleSubmitError(error: unknown): void {
        this.submitError.set(this.getSubmitErrorMessage(error));

        if (!(error instanceof HttpErrorResponse)) {
            return;
        }

        if (error.status !== 400 && error.status !== 422) {
            return;
        }

        const body: unknown = error.error;

        if (!body || typeof body !== 'object' || !('errors' in body)) {
            return;
        }

        const errors = body.errors;

        if (!errors || typeof errors !== 'object') {
            return;
        }

        const messages = Object.values(errors)
            .filter(
                (value): value is string[] =>
                    Array.isArray(value) &&
                    value.every((item) => typeof item === 'string'),
            )
            .flat();

        this.validationErrors.set(messages);
    }

    private getSubmitErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                case 422:
                    return 'Please correct the validation errors and try again.';

                case 401:
                    return 'Your session has expired. Please sign in again.';

                case 403:
                    return 'You do not have permission to reschedule appointments.';

                case 404:
                    return 'This appointment could not be found. It may have been deleted.';

                case 409:
                    return 'The doctor already has an appointment during this time. Please choose another time.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to reschedule the appointment. Please try again.';
            }
        }

        return 'An unexpected error occurred while rescheduling the appointment.';
    }


    private getErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                    return 'The appointment ID is invalid.';

                case 401:
                    return 'Your session has expired. Please sign in again.';

                case 403:
                    return 'You do not have permission to view this appointment.';

                case 404:
                    return 'The requested appointment could not be found.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to load the appointment. Please try again.';
            }
        }

        return 'An unexpected error occurred while loading the appointment.';
    }

    private isRetryable(error: unknown): boolean {
        return error instanceof HttpErrorResponse &&
            (error.status === 0 ||
                error.status === 408 ||
                error.status === 429 ||
                error.status >= 500);
    }
}
