
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
} from 'rxjs';

import { HealthService } from '../../core/services/health';
import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';
import { AppointmentService } from '../appointments/appointment.service';
import { Appointment } from '../appointments/appointment.model';
import {
  getAppointmentStatusLabel,
  getAppointmentStatusClass,
} from '../appointments/appointment-status.utils';

type ApiStatus = 'checking' | 'connected' | 'unavailable';

interface TodayAppointment {
  appointment: Appointment;
  patientName: string;
  doctorName: string;
}

type TodayState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; appointments: TodayAppointment[] };

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly healthService = inject(HealthService);
  private readonly patientService = inject(PatientService);
  private readonly doctorService = inject(DoctorService);
  private readonly appointmentService = inject(AppointmentService);

  protected readonly getStatusLabel = getAppointmentStatusLabel;
  protected readonly getStatusClass = getAppointmentStatusClass;

  // Office-local date, formatted as YYYY-MM-DD.
  protected readonly today = this.formatLocalDate(new Date());

  private readonly patients$ = this.patientService.getAll().pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly doctors$ = this.doctorService.getAll().pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly apiStatus = toSignal(
    this.healthService.checkHealth().pipe(
      map((response): ApiStatus =>
        response.status === 'Healthy'
          ? 'connected'
          : 'unavailable'
      ),
      catchError(() => of<ApiStatus>('unavailable')),
      startWith<ApiStatus>('checking'),
    ),
    { initialValue: 'checking' as ApiStatus },
  );

  protected readonly patientCount = toSignal(
    this.patients$.pipe(
      map((patients) => patients.length),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null as number | null },
  );

  protected readonly doctorCount = toSignal(
    this.doctors$.pipe(
      map((doctors) => doctors.length),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null as number | null },
  );

  protected readonly todayState = toSignal(
    forkJoin({
      appointments: this.appointmentService.getAll({
        date: this.today,
      }),
      patients: this.patients$,
      doctors: this.doctors$,
    }).pipe(
      map(({ appointments, patients, doctors }): TodayState => {
        const patientNames = new Map(
          patients.map((patient) => [
            patient.id,
            `${patient.firstName} ${patient.lastName}`,
          ]),
        );

        const doctorNames = new Map(
          doctors.map((doctor) => [
            doctor.id,
            `Dr. ${doctor.firstName} ${doctor.lastName}`,
          ]),
        );

        const sortedAppointments = [...appointments].sort(
          (a, b) => a.startTime.localeCompare(b.startTime),
        );

        return {
          status: 'loaded',
          appointments: sortedAppointments.map((appointment) => ({
            appointment,
            patientName:
              patientNames.get(appointment.patientId) ??
              'Unknown patient',
            doctorName:
              doctorNames.get(appointment.doctorId) ??
              'Unknown doctor',
          })),
        };
      }),
      catchError(() => of<TodayState>({ status: 'error' })),
      startWith<TodayState>({ status: 'loading' }),
    ),
    { initialValue: { status: 'loading' } as TodayState },
  );

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
