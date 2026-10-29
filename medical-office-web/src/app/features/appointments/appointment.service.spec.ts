
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import {
  Appointment,
  AppointmentStatus,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
  UpdateAppointmentStatusRequest,
} from './appointment.model';
import { AppointmentService } from './appointment.service';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let httpMock: HttpTestingController;

  const apiUrl = `${environment.apiBaseUrl}/appointments`;

  const appointment: Appointment = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    patientId: 'a1234567-b491-4e62-8519-d1f197c1a12e',
    doctorId: 'b1234567-b491-4e62-8519-d1f197c1a12e',
    startTime: '2026-10-20T09:00:00',
    endTime: '2026-10-20T09:30:00',
    status: AppointmentStatus.Scheduled,
    notes: 'Follow-up consultation',
    rowVersion: 'AQIDBAUGBwg=',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AppointmentService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AppointmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve all appointments without filters', () => {
    service.getAll().subscribe((result) => {
      expect(result).toEqual([appointment]);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([appointment]);
  });

  it('should filter appointments by doctor and date', () => {
    service.getAll({
      doctorId: appointment.doctorId,
      date: '2026-10-20',
    }).subscribe((result) => {
      expect(result).toEqual([appointment]);
    });

    const request = httpMock.expectOne(
      (req) => req.url === apiUrl,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('doctorId'))
      .toBe(appointment.doctorId);
    expect(request.request.params.get('date'))
      .toBe('2026-10-20');

    request.flush([appointment]);
  });

  it('should retrieve an appointment by ID', () => {
    service.getById(appointment.id).subscribe((result) => {
      expect(result).toEqual(appointment);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${appointment.id}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(appointment);
  });

  it('should create an appointment', () => {
    const createRequest: CreateAppointmentRequest = {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      notes: appointment.notes,
    };

    service.create(createRequest).subscribe((result) => {
      expect(result).toEqual(appointment);
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    request.flush(appointment, {
      status: 201,
      statusText: 'Created',
    });
  });

  it('should reschedule an appointment', () => {
    const rescheduleRequest: RescheduleAppointmentRequest = {
      startTime: '2026-10-20T10:00:00',
      endTime: '2026-10-20T10:30:00',
      rowVersion: appointment.rowVersion,
    };

    service.reschedule(
      appointment.id,
      rescheduleRequest,
    ).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${appointment.id}/reschedule`,
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(rescheduleRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should update appointment status', () => {
    const statusRequest: UpdateAppointmentStatusRequest = {
      status: AppointmentStatus.Completed,
      rowVersion: appointment.rowVersion,
    };

    service.updateStatus(
      appointment.id,
      statusRequest,
    ).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${appointment.id}/status`,
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(statusRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should delete an appointment', () => {
    service.delete(appointment.id, appointment.rowVersion).subscribe((result) => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${appointment.id}`,
    );

    expect(request.request.method).toBe('DELETE');

    request.flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('should propagate HTTP 404 errors', () => {
    let actualStatus: number | undefined;

    service.getById(appointment.id).subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${appointment.id}`,
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

  it('should propagate HTTP 409 overlap conflicts', () => {
    let actualStatus: number | undefined;

    service.create({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    }).subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(apiUrl);

    request.flush(
      {
        title: 'Conflict',
        detail: 'The doctor already has an appointment during this time.',
      },
      {
        status: 409,
        statusText: 'Conflict',
      },
    );

    expect(actualStatus).toBe(409);
  });

  
  it('should filter appointments by doctor only', () => {
    service.getAll({
      doctorId: appointment.doctorId,
    }).subscribe((result) => {
      expect(result).toEqual([appointment]);
    });

    const request = httpMock.expectOne(
      (req) => req.url === apiUrl,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('doctorId'))
      .toBe(appointment.doctorId);
    expect(request.request.params.has('date')).toBe(false);

    request.flush([appointment]);
  });

  
  it('should filter appointments by date only', () => {
    service.getAll({
      date: '2026-10-20',
    }).subscribe((result) => {
      expect(result).toEqual([appointment]);
    });

    const request = httpMock.expectOne(
      (req) => req.url === apiUrl,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('date'))
      .toBe('2026-10-20');
    expect(request.request.params.has('doctorId')).toBe(false);

    request.flush([appointment]);
  });

});
