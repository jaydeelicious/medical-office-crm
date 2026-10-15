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

import { CreateDoctorRequest, Doctor } from '../doctor.model';
import { DoctorService } from '../doctor.service';
import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

@Component({
    selector: 'app-doctor-form',
    imports: [
        ReactiveFormsModule,
        LoadingIndicator,
        ErrorMessage,
    ],
    templateUrl: './doctor-form.html',
    styleUrl: './doctor-form.scss',
})
export class DoctorForm implements OnInit {
    private readonly fb = inject(FormBuilder).nonNullable;
    private readonly doctorService = inject(DoctorService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly isEditMode = signal(false);
    readonly isLoading = signal(false);
    readonly isSubmitting = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly validationErrors = signal<string[]>([]);
    readonly isDoctorLoaded = signal(false);

    private doctorId: string | null = null;

    readonly form = this.fb.group({
        firstName: [
            '',
            [
                Validators.required,
                Validators.maxLength(100),
                Validators.pattern(/.*\S.*/),
            ],
        ],
        lastName: [
            '',
            [
                Validators.required,
                Validators.maxLength(100),
                Validators.pattern(/.*\S.*/),
            ],
        ],
        specialty: [
            '',
            [
                Validators.required,
                Validators.maxLength(150),
                Validators.pattern(/.*\S.*/),
            ],
        ],
        email: [
            '',
            [
                Validators.email,
                Validators.maxLength(200),
            ],
        ],
        phone: ['', Validators.maxLength(30)],
    });

    get firstName() {
        return this.form.controls.firstName;
    }

    get lastName() {
        return this.form.controls.lastName;
    }

    get specialty() {
        return this.form.controls.specialty;
    }

    get email() {
        return this.form.controls.email;
    }

    get phone() {
        return this.form.controls.phone;
    }

    ngOnInit(): void {
        this.doctorId = this.route.snapshot.paramMap.get('id');
        this.isEditMode.set(this.doctorId !== null);

        if (this.doctorId) {
            this.loadDoctor(this.doctorId);
        }
    }

    private loadDoctor(id: string): void {
        this.isLoading.set(true);
        this.isDoctorLoaded.set(false);
        this.errorMessage.set(null);

        this.doctorService
            .getById(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (doctor: Doctor) => {
                    this.form.patchValue({
                        firstName: doctor.firstName,
                        lastName: doctor.lastName,
                        specialty: doctor.specialty,
                        email: doctor.email ?? '',
                        phone: doctor.phone ?? '',
                    });

                    this.isDoctorLoaded.set(true);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.errorMessage.set(this.getErrorMessage(error));
                    this.isDoctorLoaded.set(false);
                    this.isLoading.set(false);
                },
            });
    }

    onSubmit(): void {
        if (
            this.isSubmitting() ||
            this.isLoading() ||
            (this.isEditMode() && !this.isDoctorLoaded())
        ) {
            return;
        }

        this.form.markAllAsTouched();

        if (this.form.invalid) {
            return;
        }

        const values = this.form.getRawValue();

        const request: CreateDoctorRequest = {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            specialty: values.specialty.trim(),
            email: values.email.trim() || null,
            phone: values.phone.trim() || null,
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.validationErrors.set([]);

        const operation: Observable<void> =
            this.isEditMode() && this.doctorId
                ? this.doctorService.update(this.doctorId, request)
                : this.doctorService.create(request).pipe(
                    map(() => void 0),
                );
        
        operation
            .pipe(
                finalize(() => this.isSubmitting.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    void this.router.navigate(['/doctors']);
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

        void this.router.navigate(['/doctors']);
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

    private getErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                case 422:
                    return 'Please correct the validation errors and try again.';

                case 401: 
                    return 'Your session has expired. Please sign in again.';
                
                case 403: 
                    return 'You do not have permission to save doctors.';

                case 404: 
                    return 'The requested doctor could not be found.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to save the doctor. Please try again.';
            }
        }

        return 'An unexpected error occured.';
    }
}