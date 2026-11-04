
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuditLog, PagedResult } from './audit-log.model';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let httpMock: HttpTestingController;

  const apiUrl = `${environment.apiBaseUrl}/audit-logs`;

  const auditLog: AuditLog = {
    id: '11111111-1111-1111-1111-111111111111',
    occurredAtUtc: '2026-11-03T10:30:00Z',
    entityType: 'Patient',
    entityId: '22222222-2222-2222-2222-222222222222',
    action: 'Updated',
    userId: 'test-user-id',
  };

  const pagedResult: PagedResult<AuditLog> = {
    items: [auditLog],
    page: 1,
    pageSize: 20,
    totalCount: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuditLogService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuditLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve paginated audit history', () => {
    service.getPaged().subscribe((result) => {
      expect(result).toEqual(pagedResult);
    });

    const request = httpMock.expectOne(
        (req) => req.url === apiUrl,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush(pagedResult);
  });

  it('should serialize combined filters and pagination', () => {
    service.getPaged({
      entityType: 'Patient',
      entityId: auditLog.entityId,
      action: 'Updated',
      userId: 'test-user-id',
      fromUtc: '2026-11-01T00:00:00.000Z',
      toUtc: '2026-11-03T23:59:59.999Z',
      page: 2,
      pageSize: 10,
    }).subscribe();

    const request = httpMock.expectOne(
        (req) => req.url === apiUrl,
    );

    expect(request.request.method).toBe('GET');

    const params = request.request.params;

    expect(params.get('entityType')).toBe('Patient');
    expect(params.get('entityId')).toBe(auditLog.entityId);
    expect(params.get('action')).toBe('Updated');
    expect(params.get('userId')).toBe('test-user-id');
    expect(params.get('fromUtc'))
      .toBe('2026-11-01T00:00:00.000Z');
    expect(params.get('toUtc'))
      .toBe('2026-11-03T23:59:59.999Z');
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('10');

    request.flush({
      items: [],
      page: 2,
      pageSize: 10,
      totalCount: 1,
    });
  });

  it('should omit undefined and empty filters', () => {
    service.getPaged({
      entityType: undefined,
      userId: '',
      page: 1,
      pageSize: 20,
    }).subscribe();

    const request = httpMock.expectOne(
        (req) => req.url === apiUrl,
    );

    expect(request.request.params.has('entityType')).toBe(false);
    expect(request.request.params.has('userId')).toBe(false);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');

    request.flush(pagedResult);
  });

  it('should retrieve an audit event by ID', () => {
    service.getById(auditLog.id).subscribe((result) => {
      expect(result).toEqual(auditLog);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${auditLog.id}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(auditLog);
  });

  it('should propagate an HTTP 403 response', () => {
    let actualStatus: number | undefined;

    service.getPaged().subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(apiUrl);

    request.flush(
      { title: 'Forbidden' },
      {
        status: 403,
        statusText: 'Forbidden',
      },
    );

    expect(actualStatus).toBe(403);
  });

  it('should propagate an HTTP 400 response', () => {
    let actualStatus: number | undefined;

    service.getPaged({ page: 0 }).subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne(
      (req) => req.url === apiUrl,
    );

    request.flush(
      { title: 'Bad Request' },
      {
        status: 400,
        statusText: 'Bad Request',
      },
    );

    expect(actualStatus).toBe(400);
  });
});
