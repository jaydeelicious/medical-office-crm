
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  CreatePatientRequest,
  Patient,
  UpdatePatientRequest,
} from './patient.model';
import { PatientService } from './patient.service';

describe('PatientService', () => {
  let service: PatientService;
  let httpMock: HttpTestingController;

  const apiUrl = `${environment.apiBaseUrl}/patients`;

  const patient: Patient = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    email: 'john@example.com',
    dateOfBirth: '1990-05-21',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PatientService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PatientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve all patients', () => {
    const patients = [patient];

    service.getAll().subscribe((result) => {
      expect(result).toEqual(patients);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('GET');

    request.flush(patients);
  });

  it('should retrieve a patient by ID', () => {
    service.getById(patient.id).subscribe((result) => {
      expect(result).toEqual(patient);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${patient.id}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(patient);
  });

  it('should create a patient', () => {
    const createRequest: CreatePatientRequest = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      dateOfBirth: '1990-05-21',
    };

    service.create(createRequest).subscribe((result) => {
      expect(result).toEqual(patient);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    request.flush(patient, {
      status: 201,
      statusText: 'Created',
    });
  });

  it('should update a patient', () => {
    const updateRequest: UpdatePatientRequest = {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      email: 'jane@example.com',
      dateOfBirth: '1990-05-21',
    };

    service.update(patient.id, updateRequest).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${patient.id}`,
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updateRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should delete a patient', () => {
    service.delete(patient.id).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${patient.id}`,
    );

    expect(request.request.method).toBe('DELETE');

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should propagate HTTP errors', () => {
    let actualStatus: number | undefined;

    service.getById(patient.id).subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${patient.id}`,
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
