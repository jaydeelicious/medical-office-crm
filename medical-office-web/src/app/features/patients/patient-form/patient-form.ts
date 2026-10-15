
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
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, map, Observable } from 'rxjs';

import { CreatePatientRequest, Patient } from '../patient.model';
import { PatientService } from '../patient.service';
import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

@Component({
    selector: 'app-patient-form',
    imports: [
        ReactiveFormsModule,
        LoadingIndicator,
        ErrorMessage,
    ],
    templateUrl: './patient-form.html',
    styleUrl: './patient-form.scss',
})
export class PatientForm implements OnInit {
    private readonly fb = inject(FormBuilder).nonNullable;
    private readonly patientService = inject(PatientService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly isEditMode = signal(false);
    readonly isLoading = signal(false);
    readonly isSubmitting = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly validationErrors = signal<string[]>([]);
    readonly isPatientLoaded = signal(false);

    private patientId: string | null = null;

    readonly form = this.fb.group({
        firstName: [
            '',
            [
                Validators.required,
                Validators.maxLength(100),
                Validators.pattern(/\S/),
            ],
        ],
        lastName: [
            '',
            [
                Validators.required,
                Validators.maxLength(100),
                Validators.pattern(/\S/),
            ],
        ],
        phone: ['', Validators.maxLength(30)],
        email: [
            '',
            [
                Validators.email,
                Validators.maxLength(200),
            ],
        ],
        dateOfBirth: [''],
    });

    get firstName() {
        return this.form.controls.firstName;
    }

    get lastName() {
        return this.form.controls.lastName;
    }

    get phone() {
        return this.form.controls.phone;
    }

    get email() {
        return this.form.controls.email;
    }

    get dateOfBirth() {
        return this.form.controls.dateOfBirth;
    }

    ngOnInit(): void {
        this.patientId = this.route.snapshot.paramMap.get('id');
        this.isEditMode.set(this.patientId !== null);

        if (this.patientId) {
            this.loadPatient(this.patientId);
        }
    }

    private loadPatient(id: string): void {
        this.isLoading.set(true);
        this.isPatientLoaded.set(false);
        this.errorMessage.set(null);

        this.patientService
            .getById(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (patient: Patient) => {
                    this.form.patchValue({
                        firstName: patient.firstName,
                        lastName: patient.lastName,
                        phone: patient.phone ?? '',
                        email: patient.email ?? '',
                        dateOfBirth: patient.dateOfBirth ?? '',
                    });

                    this.isPatientLoaded.set(true);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.errorMessage.set(this.getErrorMessage(error));
                    this.isLoading.set(false);
                },
            });
    }

    onSubmit(): void {
        if (
            this.isSubmitting() || 
            this.isLoading() ||
            (this.isEditMode() && !this.isPatientLoaded())
        ) {
            return;
        }

        this.form.markAllAsTouched();

        if (this.form.invalid) {
            return;
        }

        const values = this.form.getRawValue();

        const request: CreatePatientRequest = {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            phone: values.phone.trim() || null,
            email: values.email.trim() || null,
            dateOfBirth: values.dateOfBirth || null,
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.validationErrors.set([]);

        const operation: Observable<void> =
            this.isEditMode() && this.patientId
                ? this.patientService.update(this.patientId, request)
                : this.patientService.create(request).pipe(
                    map(() => void 0),
                );

        operation
            .pipe(
                finalize(() => this.isSubmitting.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    void this.router.navigate(['/patients']);
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

        void this.router.navigate(['/patients']);
    }

    private handleSubmitError(error: unknown): void {
        this.errorMessage.set(this.getErrorMessage(error));

        if (!(error instanceof HttpErrorResponse)) {
            return;
        }

        if (error.status !== 400 && error.status !== 422) {
            return;
        }

        const body: unknown = error.error;

        if (!body || typeof body !== 'object') {
            return;
        }

        if (!('errors' in body)) {
            return;
        }

        const errors = body.errors;

        if (!errors || typeof errors !== 'object') {
            return;
        }

        const messages = Object.values(errors)
            .filter((value): value is string[] =>
                Array.isArray(value) &&
                value.every((item) => typeof item === 'string'),
            )
            .flat();

        this.validationErrors.set(messages);
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                case 422:
                    return 'Please correct the validation errors and try again.';

                case 401:
                    return 'Your session has expired. Please sign in again.';

                case 403:
                    return 'You do not have permission to save patients.';

                case 404:
                    return 'The requested patient could not be found.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to save the patient. Please try again.';
            }
        }

        return 'An unexpected error occurred.';
    }
}
