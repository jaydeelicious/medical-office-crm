import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
    Doctor,
    CreateDoctorRequest,
    UpdateDoctorRequest,
} from './doctor.model';

@Injectable({
    providedIn: 'root',
})
export class DoctorService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiBaseUrl}/doctors`;

    getAll(): Observable<Doctor[]> {
        return this.http.get<Doctor[]>(this.apiUrl);
    }

    getById(id: string): Observable<Doctor> {
        return this.http.get<Doctor>(`${this.apiUrl}/${id}`);
    }

    create(request: CreateDoctorRequest): Observable<Doctor> {
        return this.http.post<Doctor>(this.apiUrl, request);
    }

    update(
        id: string,
        request: UpdateDoctorRequest,
    ): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/${id}`, request);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}