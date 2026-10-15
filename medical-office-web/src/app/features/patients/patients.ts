import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

import { Patient } from './patient.model';
import { PatientService } from './patient.service';

import { RouterLink } from '@angular/router';

import { LoadingIndicator } from '../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-patients',
  imports: [
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorMessage,
    ConfirmDialog,
  ],
  templateUrl: './patients.html',
  styleUrl: './patients.scss',
})
export class Patients implements OnInit {
  private readonly patientService = inject(PatientService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patients = signal<Patient[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canRetry = signal(false);
  readonly patientToDelete = signal<Patient | null>(null);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.canRetry.set(false);

    this.patientService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (patients) => {
          this.patients.set(patients);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.patients.set([]);
          this.errorMessage.set(this.getErrorMessage(error));
          this.canRetry.set(this.isRetryable(error));
          this.isLoading.set(false);
        },
      });
  }

  requestDelete(patient: Patient): void {
    if (this.isDeleting()) {
      return;
    }

    this.deleteError.set(null);
    this.patientToDelete.set(patient);
  }

  cancelDelete(): void {
    if (this.isDeleting()) {
      return;
    }

    this.patientToDelete.set(null);
  }

  confirmDelete(): void {
    const patient = this.patientToDelete();

    if (!patient || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.deleteError.set(null);

    this.patientService
      .delete(patient.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patients.update((patients) => 
            patients.filter((item) => item.id !== patient.id),
        );

          this.patientToDelete.set(null);
          this.isDeleting.set(false);
        },
        error: (error: unknown) => {
          this.deleteError.set(this.getDeleteErrorMessage(error));
          this.patientToDelete.set(null);
          this.isDeleting.set(false);
        },
      });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          return 'Your session has expired. Please sign in again.';

        case 403: 
          return 'You do not have permission to view patients.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default: 
          return 'Unable to load patients. Please try again';
      }
    }

    return 'An unexpected error occured while loading patients.';
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof HttpErrorResponse &&
      (error.status === 0 ||
        error.status === 408 ||
        error.status === 429 || 
        error.status >= 500);
  }

  private getDeleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          return 'Your session has expired. Please sign in again.';

        case 403:
          return 'You do not have permission to delete patients.';

        case 404:
          return 'The patient could not be found. It may have already been deleted.';

        case 409:
          return 'This patient cannot be deleted because of existing related records.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to delete the patient. Please try again.';
      }
    }

    return 'An unexpected error occured while deleting the patient.';
  }
}