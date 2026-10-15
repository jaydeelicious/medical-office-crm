import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { authTokenInterceptor } from './auth-token-interceptor';
import { apiErrorInterceptor } from './api-error-interceptor';

describe('authTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const authServiceMock = {
    getAccessToken: vi.fn().mockReturnValue(of('test-access-token')),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    authServiceMock.getAccessToken.mockReturnValue(
      of('test-access-token'),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            authTokenInterceptor,
            apiErrorInterceptor,
          ]),
        ),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches a bearer token to a protected API request', () => {
    http.get('/api/patients').subscribe();

    const request = httpMock.expectOne('/api/patients');

    expect(request.request.headers.get('Authorization'))
      .toBe('Bearer test-access-token');

    request.flush([]);
  });

  it('does not attach a token when none is available', () => {
    authServiceMock.getAccessToken.mockReturnValue(of(''));

    http.get('/api/doctors').subscribe();

    const request = httpMock.expectOne('/api/doctors');

    expect(request.request.headers.has('Authorization'))
      .toBe(false);

    request.flush([]);
  });

  it.each([
    '/api/health',
    '/api-external/patients',
    'https://example.com/api/patients',
    '/auth/callback',
    '/api/../external',
    '/api/patients-extra',
  ])('does not attach a token to %s', (url) => {
    http.get(url).subscribe();

    const request = httpMock.expectOne(url);

    expect(request.request.headers.has('Authorization'))
      .toBe(false);

    expect(authServiceMock.getAccessToken)
      .not.toHaveBeenCalled();

    request.flush({});
  });

  it('preserves query parameters on trusted requests', () => {
    const url = '/api/patients?search=John%20Doe';

    http.get(url).subscribe();

    const request = httpMock.expectOne(url);

    expect(request.request.headers.get('Authorization'))
      .toBe('Bearer test-access-token');

    request.flush([]);
  });

  it('preserves existing HTTP error handling', () => {
    let receivedStatus: number | undefined;

    http.get('/api/patients').subscribe({
      error: (error) => {
        receivedStatus = error.status;
      },
    });

    const request = httpMock.expectOne('/api/patients');

    request.flush(
      { title: 'Internal Server Error' },
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );

    expect(receivedStatus).toBe(500);
  });
});