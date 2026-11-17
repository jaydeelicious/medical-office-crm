import { HttpErrorResponse } from '@angular/common/http';
import { 
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { 
  ActivatedRoute,
  Router,
  RouterLink 
} from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { Appointment, AppointmentFilters } from './appointment.model';
import { AppointmentService } from './appointment.service';

import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';

import { LoadingIndicator } from '../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorMessage } from '../../shared/components/error-message/error-message';

import { Doctor } from '../doctors/doctor.model';
import { Patient } from '../patients/patient.model';

import {
  getAppointmentStatusLabel,
  getAppointmentStatusClass,
} from './appointment-status.utils';

@Component({
  selector: 'app-appointments',
  imports: [
    DatePipe,
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorMessage,
  ],
  templateUrl: './appointments.html',
  styleUrl: './appointments.scss',
})
export class Appointments implements OnInit {
  private readonly appointmentService = inject(AppointmentService);
  private readonly patientService = inject(PatientService);
  private readonly doctorService = inject(DoctorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly appointments = signal<Appointment[]>([]);
  readonly patientNames = signal<Map<string, string>>(new Map());
  readonly doctorNames = signal<Map<string, string>>(new Map());
  readonly getStatusLabel = getAppointmentStatusLabel;
  readonly getStatusClass = getAppointmentStatusClass;

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);  
  readonly canRetry = signal(false);

  readonly selectedDoctorId = signal('');
  readonly selectedDate = signal('');

  readonly selectedPatientId = signal('');
  readonly patientsList = signal<Patient[]>([]);

  readonly appliedFilters = signal<AppointmentFilters>({});

  readonly doctorsList = signal<Doctor[]>([]);

  readonly appointmentCount = computed(
    () => this.appointments().length,
  );

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const filters: AppointmentFilters = {
          ...(params.get('patientId')
            ? { patientId: params.get('patientId')! }
            : {}),
          ...(params.get('doctorId')
            ? { doctorId: params.get('doctorId')! }
            : {}),
          ...(params.get('date')
            ? { date: params.get('date')! }
            : {}),
        };

        this.selectedPatientId.set(filters.patientId ?? '');
        this.selectedDoctorId.set(filters.doctorId ?? '');
        this.selectedDate.set(filters.date ?? '');

        this.appliedFilters.set(filters);
        this.loadAppointments();
      });
  }

  loadAppointments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.canRetry.set(false);
    
    forkJoin({
      appointments: this.appointmentService.getAll(
        this.appliedFilters(),
      ),
      patients: this.patientService.getAll(),
      doctors: this.doctorService.getAll(), 
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ appointments, patients, doctors }) => {
          this.appointments.set(appointments);
          
          this.patientNames.set(
            new Map(
              patients.map((patient) => [
                patient.id, 
                `${patient.firstName} ${patient.lastName}`,
              ]),
            ),
          );

          this.doctorNames.set(
            new Map(
              doctors.map((doctor) => [
                doctor.id,
                `Dr. ${doctor.firstName} ${doctor.lastName}`, 
              ]),
            ),
          );

          this.doctorsList.set(doctors);
          this.patientsList.set(patients);

          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.appointments.set([]);
          this.patientNames.set(new Map());
          this.doctorNames.set(new Map());
          this.patientsList.set([]);

          this.errorMessage.set(this.getErrorMessage(error));
          this.canRetry.set(this.isRetryable(error));
          this.isLoading.set(false);
        },
      });
  }

  getPatientName(patientId: string): string {
    return this.patientNames().get(patientId) ?? 'Unknown patient';
  }

  getDoctorName(doctorId: string): string {
    return this.doctorNames().get(doctorId) ?? 'Unknown doctor';
  }

  applyFilters(): void {
      void this.router.navigate(['/appointments'], {
          queryParams: {
              patientId: this.selectedPatientId() || null,
              doctorId: this.selectedDoctorId() || null,
              date: this.selectedDate() || null,
          },
      });
  }

  clearFilters(): void {
      void this.router.navigate(['/appointments'], {
          queryParams: {
              patientId: null,
              doctorId: null,
              date: null,
          },
      });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          return 'Your session has expired. Please sign in again.';
        
        case 403:
          return 'You do not have permission to view appointments.';

        case 0:
          return 'Unable to connect to the server. Please check your connection.';

        default:
          return 'Unable to load appointments. Please try again.';
      }
    }

    return 'An unexpected error occured while loading appointments.';
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof HttpErrorResponse &&
      (error.status === 0 ||
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500);
  }
}
