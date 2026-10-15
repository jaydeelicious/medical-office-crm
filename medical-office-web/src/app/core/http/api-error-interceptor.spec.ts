
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';
import { apiErrorInterceptor } from './api-error-interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([apiErrorInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('preserves server HTTP errors', () => {
    let receivedError: HttpErrorResponse | undefined;

    http.get('/api/health').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = httpMock.expectOne('/api/health');

    request.flush(
      { title: 'Internal Server Error' },
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(receivedError?.status).toBe(500);
  });

  it('preserves network failures', () => {
    let receivedError: HttpErrorResponse | undefined;

    http.get('/api/health').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = httpMock.expectOne('/api/health');

    request.error(new ProgressEvent('error'));

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(receivedError?.status).toBe(0);
  });

  
it('preserves 401 authentication errors', () => {
    let receivedError: HttpErrorResponse | undefined;

    http.get('/api/patients').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = httpMock.expectOne('/api/patients');

    request.flush(
      { title: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(receivedError?.status).toBe(401);
  });

  
it('preserves 403 authorization errors', () => {
    let receivedError: HttpErrorResponse | undefined;

    http.get('/api/patients').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const request = httpMock.expectOne('/api/patients');

    request.flush(
      { title: 'Forbidden' },
      {
        status: 403,
        statusText: 'Forbidden',
      },
    );

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    expect(receivedError?.status).toBe(403);
  });

  
it('does not retry requests after a 401 response', () => {
    const receivedErrors: HttpErrorResponse[] = [];

    http.get('/api/patients').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedErrors.push(error);
      },
    });

    const request = httpMock.expectOne('/api/patients');

    request.flush(
      { title: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(receivedErrors).toHaveLength(1);
    expect(receivedErrors[0].status).toBe(401);

    httpMock.expectNone('/api/patients');
  });
});
