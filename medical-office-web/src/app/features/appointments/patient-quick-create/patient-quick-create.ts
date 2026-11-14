import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  output, 
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import {
  CreatePatientRequest,
  Patient,
} from '../../patients/patient.model';
import { PatientService } from '../../patients/patient.service';
import { DateOfBirthPicker } from '../../../shared/components/date-of-birth-picker/date-of-birth-picker';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

@Component({
  selector: 'app-patient-quick-create',
  imports: [
    ReactiveFormsModule,
    DateOfBirthPicker,
    ErrorMessage,
  ],
  templateUrl: './patient-quick-create.html',
  styleUrl: './patient-quick-create.scss',
})
export class PatientQuickCreate {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly patientService = inject(PatientService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientCreated = output<Patient>();
  readonly cancelled = output<void>();

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly validationErrors = signal<string[]>([]);

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

  onSubmit(): void {
    if (this.isSubmitting()) {
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

    this.patientService.create(request)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (patient: Patient) => {
          this.patientCreated.emit(patient);
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

    this.cancelled.emit();
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

    if (!body || typeof body !== 'object' ||
        !('errors' in body)) {
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
          value.every(item => typeof item === 'string'),
      )
      .flat();

    this.validationErrors.set(messages);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
        case 422:
          return 'Please correct the patient information and try again.';

        case 401:
          return 'Your session has expired. Please sign in again.';

        case 403: 
          return 'You do not have permission to create patients.';

        case 409:
          return 'A patient conflict occurred. Please check whether this patient already exists.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to create the patient. Please try again.';
      }
    }

    return 'An unexpected error occurred while creating the patient.';
  }
}