
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ErrorMessage } from '../../../shared/components/error-message/error-message';
import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { Doctor } from '../doctor.model';
import { DoctorService } from '../doctor.service';

@Component({
  selector: 'app-doctor-details',
  imports: [
    RouterLink,
    ErrorMessage,
    LoadingIndicator,
  ],
  templateUrl: './doctor-details.html',
  styleUrl: './doctor-details.scss',
})
export class DoctorDetails implements OnInit {
  private readonly doctorService = inject(DoctorService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly doctor = signal<Doctor | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canRetry = signal(false);

  ngOnInit(): void {
    this.loadDoctor();
  }

  loadDoctor(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.doctor.set(null);
      this.errorMessage.set('No doctor ID was provided.');
      this.canRetry.set(false);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.canRetry.set(false);
    this.doctor.set(null);

    this.doctorService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doctor) => {
          this.doctor.set(doctor);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.getErrorMessage(error));
          this.canRetry.set(this.isRetryable(error));
          this.isLoading.set(false);
        },
      });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'The doctor ID is invalid.';

        case 401:
          return 'Your session has expired. Please sign in again.';

        case 403:
          return 'You do not have permission to view this doctor.';

        case 404:
          return 'The requested doctor could not be found.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to load doctor details. Please try again.';
      }
    }

    return 'An unexpected error occurred while loading doctor details.';
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof HttpErrorResponse &&
      (error.status === 0 ||
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500);
  }
}
