import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
    AuditLog,
    AuditLogFilters,
    PagedResult,
} from './audit-log.model';

@Injectable({
    providedIn: 'root',
})
export class AuditLogService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 
        `${environment.apiBaseUrl}/audit-logs`;

    getPaged(filters: AuditLogFilters = {}): Observable<PagedResult<AuditLog>> {
        let params = new HttpParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== '') {
                params = params.set(key, String(value));
            }
        }

        return this.http.get<PagedResult<AuditLog>>(
            this.apiUrl,
            { params },
        );
    }

    getById(id: string): Observable<AuditLog> {
        return this.http.get<AuditLog>(
            `${this.apiUrl}/${encodeURIComponent(id)}`,
        );
    }
}