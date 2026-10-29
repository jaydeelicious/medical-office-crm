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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, switchMap, finalize } from 'rxjs';

import { Appointment, AppointmentStatus } from '../appointment.model';
import { AppointmentService } from '../appointment.service';

import { PatientService } from '../../patients/patient.service';
import { DoctorService } from '../../doctors/doctor.service';
import { getAppointmentStatusLabel } from '../appointment-status.utils';

import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ErrorMessage } from '../../../shared/components/error-message/error-message';

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-appointment-details',
    imports: [
        DatePipe,
        RouterLink,
        FormsModule,
        LoadingIndicator,
        ErrorMessage,
    ],
    templateUrl: './appointment-details.html',
    styleUrl: './appointment-details.scss',
})
export class AppointmentDetails implements OnInit {
    private readonly appointmentService = inject(AppointmentService);
    private readonly patientService = inject(PatientService);
    private readonly doctorService = inject(DoctorService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    readonly appointment = signal<Appointment | null>(null);
    readonly patientName = signal('');
    readonly doctorName = signal('');

    readonly getStatusLabel = getAppointmentStatusLabel;

    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly canRetry = signal(false);

    readonly selectedStatus = signal<AppointmentStatus>(
        AppointmentStatus.Scheduled,
    );

    readonly isUpdatingStatus = signal(false);
    readonly statusError = signal<string | null>(null);
    readonly hasStatusConflict = signal(false);

    readonly statusOptions = [
        { value: AppointmentStatus.Scheduled, label: 'Scheduled' },
        { value: AppointmentStatus.Completed, label: 'Completed' },
        { value: AppointmentStatus.Cancelled, label: 'Cancelled' },
        { value: AppointmentStatus.NoShow, label: 'No show' },
    ];

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
        this.hasStatusConflict.set(false);
        this.statusError.set(null);
        this.errorMessage.set(null);
        this.canRetry.set(false);
        this.appointment.set(null);

        this.appointmentService
            .getById(id)
            .pipe(
                switchMap((appointment) => 
                    forkJoin({
                        patient: this.patientService.getById(
                            appointment.patientId,
                        ),
                        doctor: this.doctorService.getById(
                            appointment.doctorId,
                        ),
                    }).pipe(
                        map(({ patient, doctor }) => {
                            this.patientName.set(
                                `${patient.firstName} ${patient.lastName}`,
                            );

                            this.doctorName.set(
                                `Dr. ${doctor.firstName} ${doctor.lastName}`,
                            );

                            return appointment;
                        }),
                    ),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: (appointment) => {
                    this.appointment.set(appointment);
                    this.selectedStatus.set(appointment.status);
                    this.statusError.set(null);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.errorMessage.set(this.getErrorMessage(error));
                    this.canRetry.set(this.isRetryable(error));
                    this.isLoading.set(false);
                },
            });
    }

    updateStatus(): void {
        const appointment = this.appointment();

        if (!appointment || this.isUpdatingStatus() || this.isLoading()) {
            return;
        }
        
        const newStatus = this.selectedStatus();

        if (newStatus === appointment.status) {
            return;
        }

        this.isUpdatingStatus.set(true);
        this.statusError.set(null);

        this.appointmentService
            .updateStatus(appointment.id, { 
                status: newStatus,
                rowVersion: appointment.rowVersion,
            })
            .pipe(
                finalize(() => this.isUpdatingStatus.set(false)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    // Fetch the updated status and the new SQL Server RowVersion.
                    this.loadAppointment();
                },
                error: (error: unknown) => {
                    this.selectedStatus.set(appointment.status);

                    const isConflict = 
                        error instanceof HttpErrorResponse &&
                        error.status === 409;

                    this.hasStatusConflict.set(isConflict);
                    this.statusError.set(this.getStatusErrorMessage(error));
                },
            });
    }

    private getStatusErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                    return 'The selected appointment status is invalid.';

                case 401:
                    return 'Your session has expired. Please sign in again.';

                case 403:
                    return 'You do not have permission to update appointment status.';

                case 404:
                    return 'This appointment could not be found.';

                case 409:
                    return 'This appointment was modified by another user. Refresh it to see the latest changes before trying again.';

                case 0:
                    return 'Unable to connect to the server. Please check your connection.';

                default:
                    return 'Unable to update appointment status. Please try again.';
            }
        }

        return 'An unexpected error occurred while updating the appointment status.';
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
          return 'The appointment or its related records could not be found.';
        case 0:
          return 'Unable to connect to the server. Please check your connection.';
        default:
          return 'Unable to load appointment details. Please try again.';
      }
    }

    return 'An unexpected error occurred while loading appointment details.';
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof HttpErrorResponse &&
      (error.status === 0 ||
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500);
  }
}