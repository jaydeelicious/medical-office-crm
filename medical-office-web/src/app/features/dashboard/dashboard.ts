import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';

import { HealthService } from '../../core/services/health';

type ApiStatus = 'checking' | 'connected' | 'unavailable';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  private readonly healthService = inject(HealthService);

  protected readonly apiStatus = toSignal(
    this.healthService.checkHealth().pipe(
      map((response): ApiStatus => 
        response.status === 'Healthy' ? 'connected' : 'unavailable'
      ),
      catchError(() => of<ApiStatus>('unavailable')),
      startWith<ApiStatus>('checking'),
    ),
    { initialValue: 'checking' as ApiStatus }
  );
}