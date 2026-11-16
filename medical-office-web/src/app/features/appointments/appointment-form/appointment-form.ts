
import {
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
} from '@angular/core';

import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { Patient } from '../../patients/patient.model';
import { PatientService } from '../../patients/patient.service';

import { Doctor } from '../../doctors/doctor.model';
import { DoctorService } from '../../doctors/doctor.service';

import { AppointmentService } from '../appointment.service';
import { CreateAppointmentRequest } from '../appointment.model';

import { PatientQuickCreate } from '../patient-quick-create/patient-quick-create';

import { appointmentTimeValidator } from '../validators/appointment-time.validator';
import { appointmentFutureValidator } from '../validators/appointment-future.validator';

import {
    calculateEndTime,
    getLocalToday,
} from '../utils/appointment-datetime.utils';

import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';

@Component({
    selector: 'app-appointment-form',
    imports: [
        ReactiveFormsModule,
        LoadingIndicator,
        ErrorMessage,
        PatientQuickCreate,
    ],
    templateUrl: './appointment-form.html',
    styleUrl: './appointment-form.scss',
})
export class AppointmentForm implements OnInit {
    private readonly fb = inject(FormBuilder).nonNullable;

    private readonly patientService = inject(PatientService);
    private readonly doctorService = inject(DoctorService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly appointmentService = inject(AppointmentService);
    private readonly router = inject(Router);

    readonly patients = signal<Patient[]>([]);
    readonly doctors = signal<Doctor[]>([]);
    readonly showPatientQuickCreate = signal(false);

    readonly isEndTimeOverflow = signal(false);

    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly canRetry = signal(false);

    readonly isSubmitting = signal(false);
    readonly submitError = signal<string | null>(null);
    readonly validationErrors = signal<string[]>([]);

    readonly form = this.fb.group(
        {
            patientId: ['', Validators.required],
            doctorId: ['', Validators.required],
            date: [getLocalToday(), Validators.required],
            startTime: ['10:00', Validators.required],
            duration: [
                30,
                [
                    Validators.required,
                    Validators.min(1),
                    Validators.max(1439),
                    Validators.pattern(/^\d+$/),
                ],
            ],
            endTime: ['10:30', Validators.required],
            notes: ['', Validators.maxLength(1000)],
        },
        {
            validators: [
                appointmentTimeValidator,
                appointmentFutureValidator,
            ],
        },
    );

    ngOnInit(): void {
        this.setupTimeCalculation();
        this.loadOptions();
    }

    loadOptions(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.canRetry.set(false);

        forkJoin({
            patients: this.patientService.getAll(),
            doctors: this.doctorService.getAll(),
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ patients, doctors }) => {
                    this.patients.set(patients);
                    this.doctors.set(doctors);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.patients.set([]);
                    this.doctors.set([]);
                    this.errorMessage.set(this.getErrorMessage(error));
                    this.canRetry.set(this.isRetryable(error));
                    this.isLoading.set(false);
                },
            });
    }


    onSubmit(): void {
        if (
            this.isSubmitting() || 
            this.isLoading() ||
            this.showPatientQuickCreate()) {
            return;
        }

        this.form.markAllAsTouched();

        // Recheck against the current time when the user submits.
        this.form.updateValueAndValidity();

        if (this.form.invalid) {
            return;
        }

        if (this.patients().length === 0 || this.doctors().length === 0) {
            this.submitError.set(
                'A patient and doctor must be available to schedule an appointment.',
            );
            return;
        }

        const values = this.form.getRawValue();

        const request: CreateAppointmentRequest = {
            patientId: values.patientId,
            doctorId: values.doctorId,
            startTime: `${values.date}T${values.startTime}:00`,
            endTime: `${values.date}T${values.endTime}:00`,
            notes: values.notes.trim() || null,
        };

        this.isSubmitting.set(true);
        this.submitError.set(null);
        this.validationErrors.set([]);

        this.appointmentService
            .create(request)
            .pipe(
                finalize(() => this.isSubmitting.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: (appointment) => {
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

        void this.router.navigate(['/appointments']);
    }
    
    private setupTimeCalculation(): void {
        this.startTime.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.updateCalculatedEndTime());

        this.duration.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.updateCalculatedEndTime());
    }

    private updateCalculatedEndTime(): void {
        const calculated = this.duration.valid
            ? calculateEndTime(
                this.startTime.value,
                this.duration.value,
            )
            : null;

        this.isEndTimeOverflow.set(
            this.duration.valid &&
            this.startTime.valid &&
            calculated === null,
        );

        this.endTime.setValue(calculated ?? '');
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

    openPatientQuickCreate(): void {
        if (this.isSubmitting() || this.isLoading()) {
            return;
        }

        this.showPatientQuickCreate.set(true);
    }

    closePatientQuickCreate(): void {
        this.showPatientQuickCreate.set(false);
    }

    onPatientCreated(patient: Patient): void {
        // Add the new patient without reloading the entire list.
        this.patients.update(patients => [
            ...patients.filter(existing => existing.id !== patient.id),
            patient,
        ]);

        // Automatically select the newly created patient.
        this.patientId.setValue(patient.id);
        this.patientId.markAsDirty();
        this.patientId.updateValueAndValidity();

        // Clear errors related to patient selection.
        this.submitError.set(null);
        this.validationErrors.set([]);

        // Close the quick-create panel.
        this.showPatientQuickCreate.set(false);
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
                    return 'You do not have permission to schedule appointments.';

                case 404:
                    return 'The selected patient or doctor could not be found.';

                case 409:
                    return 'The selected doctor already has an appointment during this time. Please choose another time.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to schedule the appointment. Please try again.';
            }
        }

        return 'An unexpected error occurred while scheduling the appointment.';
    }


    private getErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 401:
                    return 'Your session has expired. Please sign in again.';

                case 403:
                    return 'You do not have permission to load patients or doctors.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to load patients and doctors. Please try again.';
            }
        }

        return 'An unexpected error occurred while loading form options.';
    }

    private isRetryable(error: unknown): boolean {
        return error instanceof HttpErrorResponse &&
            (error.status === 0 ||
                error.status === 408 ||
                error.status === 429 ||
                error.status >= 500);
    }

    get patientId() {
        return this.form.controls.patientId;
    }

    get doctorId() {
        return this.form.controls.doctorId;
    }

    get date() {
        return this.form.controls.date;
    }

    get startTime() {
        return this.form.controls.startTime;
    }

    get duration() {
        return this.form.controls.duration;
    }

    get endTime() {
        return this.form.controls.endTime;
    }

    get notes() {
        return this.form.controls.notes;
    }
}
