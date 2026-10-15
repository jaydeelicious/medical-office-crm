
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  CreateDoctorRequest,
  Doctor,
  UpdateDoctorRequest,
} from './doctor.model';
import { DoctorService } from './doctor.service';

describe('DoctorService', () => {
  let service: DoctorService;
  let httpMock: HttpTestingController;

  const apiUrl = `${environment.apiBaseUrl}/doctors`;

  const doctor: Doctor = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    email: 'john@example.com',
    specialty: 'Cardiology',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DoctorService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DoctorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve all doctors', () => {
    const doctors = [doctor];

    service.getAll().subscribe((result) => {
      expect(result).toEqual(doctors);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('GET');

    request.flush(doctors);
  });

  it('should retrieve a doctor by ID', () => {
    service.getById(doctor.id).subscribe((result) => {
      expect(result).toEqual(doctor);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${doctor.id}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(doctor);
  });

  it('should create a doctor', () => {
    const createRequest: CreateDoctorRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      specialty: 'Cardiology',
    };

    service.create(createRequest).subscribe((result) => {
      expect(result).toEqual(doctor);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    request.flush(doctor, {
      status: 201,
      statusText: 'Created',
    });
  });

  it('should update a doctor', () => {
    const updateRequest: UpdateDoctorRequest = {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      email: 'jane@example.com',
      specialty: 'Neurology',
    };

    service.update(doctor.id, updateRequest).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${doctor.id}`,
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updateRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should delete a doctor', () => {
    service.delete(doctor.id).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${doctor.id}`,
    );

    expect(request.request.method).toBe('DELETE');

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should propagate HTTP errors', () => {
    let actualStatus: number | undefined;

    service.getById(doctor.id).subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${doctor.id}`,
    );

    request.flush(
      { title: 'Not Found' },
      {
        status: 404,
        statusText: 'Not Found',
      },
    );

    expect(actualStatus).toBe(404);
  });
});
