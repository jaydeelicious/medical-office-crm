import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
    Appointment,
    AppointmentFilters,
    CreateAppointmentRequest,
    RescheduleAppointmentRequest,
    UpdateAppointmentStatusRequest,
} from './appointment.model';

@Injectable({
    providedIn: 'root',
})
export class AppointmentService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiBaseUrl}/appointments`;

    getAll(filters: AppointmentFilters = {}): Observable<Appointment[]> {
        let params = new HttpParams();

        if (filters.doctorId) {
            params = params.set('doctorId', filters.doctorId);
        }

        if (filters.date) {
            params = params.set('date', filters.date);
        }

        return this.http.get<Appointment[]>(this.apiUrl, { params });
    }

    getById(id: string): Observable<Appointment> {
        return this.http.get<Appointment>(`${this.apiUrl}/${id}`);
    }

    create(request: CreateAppointmentRequest): Observable<Appointment> {
        return this.http.post<Appointment>(this.apiUrl, request);
    }

    reschedule(
        id: string,
        request: RescheduleAppointmentRequest,
    ): Observable<void> {
        return this.http.put<void>(
            `${this.apiUrl}/${id}/reschedule`,
            request,
        );
    }

    updateStatus(
        id: string,
        request: UpdateAppointmentStatusRequest,
    ): Observable<void> {
        return this.http.patch<void>(
            `${this.apiUrl}/${id}/status`,
            request,
        );
    }

    delete(id: string, rowVersion: string): Observable<void> {
        const headers = new HttpHeaders({
            'If-Match': `"${rowVersion}"`,
        });

        return this.http.delete<void>(
            `${this.apiUrl}/${id}`,
            { headers },
        );
    }
}