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

@Component({
  selector: 'app-doctors',
  imports: [
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorMessage,
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
}