
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';

import { HealthService } from '../../core/services/health';
import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';

type ApiStatus = 'checking' | 'connected' | 'unavailable';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly healthService = inject(HealthService);
  private readonly patientService = inject(PatientService);
  private readonly doctorService = inject(DoctorService);

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
    this.patientService.getAll().pipe(
      map((patients) => patients.length),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null as number | null },
  );

  protected readonly doctorCount = toSignal(
    this.doctorService.getAll().pipe(
      map((doctors) => doctors.length),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null as number | null },
  );
}
