import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Doctor } from './doctor.model';
import { DoctorService } from './doctor.service';

import { LoadingIndicator } from '../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorMessage } from '../../shared/components/error-message/error-message';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-doctors',
  imports: [
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorMessage,
    ConfirmDialog,
  ],
  templateUrl: './doctors.html',
  styleUrl: './doctors.scss',
})
export class Doctors implements OnInit {
  private readonly doctorService = inject(DoctorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly doctors = signal<Doctor[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canRetry = signal(false);
  readonly doctorToDelete = signal<Doctor | null>(null);
  readonly isDeleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadDoctors();
  }

  loadDoctors(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.canRetry.set(false);

    this.doctorService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doctors) => {
          this.doctors.set(doctors);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.doctors.set([]);
          this.errorMessage.set(this.getErrorMessage(error));
          this.canRetry.set(this.isRetryable(error));
          this.isLoading.set(false);
        },
      });
  }

  requestDelete(doctor: Doctor): void {
    if (this.isDeleting()) {
      return;
    }

    this.deleteError.set(null);
    this.doctorToDelete.set(doctor);
  }

  cancelDelete(): void {
    if (this.isDeleting()) {
      return;
    }

    this.doctorToDelete.set(null);
  }

  confirmDelete(): void {
    const doctor = this.doctorToDelete();

    if (!doctor || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.deleteError.set(null);

    this.doctorService
      .delete(doctor.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.doctors.update((doctors) =>
            doctors.filter((item) => item.id !== doctor.id),
          );

          this.doctorToDelete.set(null);
          this.isDeleting.set(false);
        },
        error: (error: unknown) => {
          this.deleteError.set(this.getDeleteErrorMessage(error));
          this.doctorToDelete.set(null);
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
          return 'You do not have permission to view doctors.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to load doctors. Please try again.';
      }
    }

    return 'An unexpected error occured while loading doctors.';
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
          return 'You do not have permission to delete doctors.';

        case 404:
          return 'The doctor could not be found. It may have already been deleted.';

        case 409:
          return 'This doctor cannot be deleted because of existing related records.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to delete the doctor. Please try again.';
      }
    }

    return 'An unexpected error occurred while deleting the doctor.';
  }
}