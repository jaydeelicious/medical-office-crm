
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HealthService } from './health';

describe('HealthService', () => {
  let service: HealthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(HealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the backend health endpoint', () => {
    const response = { status: 'Healthy' };

    service.checkHealth().subscribe((result) => {
      expect(result).toEqual(response);
    });

    const request = httpMock.expectOne('/api/health');

    expect(request.request.method).toBe('GET');

    request.flush(response);
  });

  it('propagates HTTP errors', () => {
    let actualStatus: number | undefined;

    service.checkHealth().subscribe({
      error: (error) => {
        actualStatus = error.status;
      },
    });

    const request = httpMock.expectOne('/api/health');

    request.flush(
      { title: 'Service unavailable' },
      {
        status: 503,
        statusText: 'Service Unavailable',
      },
    );

    expect(actualStatus).toBe(503);
  });
});
