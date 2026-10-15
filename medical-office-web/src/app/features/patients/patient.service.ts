import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
    Patient,
    CreatePatientRequest,
    UpdatePatientRequest,
} from './patient.model';

@Injectable({
    providedIn: 'root',
})
export class PatientService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiBaseUrl}/patients`;

    getAll(): Observable<Patient[]> {
        return this.http.get<Patient[]>(this.apiUrl);
    }

    getById(id: string): Observable<Patient> {
        return this.http.get<Patient>(`${this.apiUrl}/${id}`);
    }

    create(request: CreatePatientRequest): Observable<Patient> {
        return this.http.post<Patient>(this.apiUrl, request);
    }

    update(
        id: string,
        request: UpdatePatientRequest,
    ): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, request);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}