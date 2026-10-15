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
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { authTokenInterceptor } from './auth-token-interceptor';
import { apiErrorInterceptor } from './api-error-interceptor';

describe('authTokenInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;

    const authServiceMock = {
        getAccessToken: vi.fn().mockReturnValue(of('test-access-token')),
        login: vi.fn(),
        logout: vi.fn(),
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


    it('uses the latest access token for each API request', () => {
        authServiceMock.getAccessToken
            .mockReturnValueOnce(of('original-token'))
            .mockReturnValueOnce(of('renewed-token'));

        http.get('/api/patients').subscribe();

        const firstRequest = httpMock.expectOne('/api/patients');

        expect(firstRequest.request.headers.get('Authorization'))
            .toBe('Bearer original-token');

        firstRequest.flush([]);

        http.get('/api/doctors').subscribe();

        const secondRequest = httpMock.expectOne('/api/doctors');

        expect(secondRequest.request.headers.get('Authorization'))
            .toBe('Bearer renewed-token');

        secondRequest.flush([]);

        expect(authServiceMock.getAccessToken)
            .toHaveBeenCalledTimes(2);
    });

    
    it('propagates token retrieval failures without sending the request', () => {
        const tokenError = new Error('Token retrieval failed');
        let receivedError: unknown;

        authServiceMock.getAccessToken.mockReturnValueOnce(
            throwError(() => tokenError),
        );

        http.get('/api/patients').subscribe({
            error: (error: unknown) => {
                receivedError = error;
            },
        });

        expect(receivedError).toBe(tokenError);

        // The request should never reach the HTTP backend.
        httpMock.expectNone('/api/patients');

        expect(authServiceMock.getAccessToken)
            .toHaveBeenCalledOnce();
    });

    
    it('waits for the access token before sending the API request', () => {
        const tokenSubject = new Subject<string>();

        authServiceMock.getAccessToken.mockReturnValueOnce(
            tokenSubject.asObservable(),
        );

        http.get('/api/appointments').subscribe();

        // No HTTP request should be sent before a token is available.
        httpMock.expectNone('/api/appointments');

        tokenSubject.next('delayed-token');
        tokenSubject.complete();

        const request = httpMock.expectOne('/api/appointments');

        expect(request.request.headers.get('Authorization'))
            .toBe('Bearer delayed-token');

        request.flush([]);

        expect(authServiceMock.getAccessToken)
            .toHaveBeenCalledOnce();
    });

    
    it('allows public requests even when token retrieval would fail', () => {
        authServiceMock.getAccessToken.mockReturnValue(
            throwError(() => new Error('Token unavailable')),
        );

        let responseReceived = false;

        http.get('/api/health').subscribe({
            next: () => {
                responseReceived = true;
            },
        });

        const request = httpMock.expectOne('/api/health');

        expect(request.request.headers.has('Authorization'))
            .toBe(false);

        request.flush({ status: 'Healthy' });

        expect(responseReceived).toBe(true);

        expect(authServiceMock.getAccessToken)
            .not.toHaveBeenCalled();
    });

    it('propagates 401 without initiating login', () => {
        let receivedStatus: number | undefined;

        http.get('/api/patients').subscribe({
            error: (error) => {
                receivedStatus = error.status;
            },
        });

        const request = httpMock.expectOne('/api/patients');

        expect(request.request.headers.get('Authorization'))
            .toBe('Bearer test-access-token');

        request.flush(
            { title: 'Unauthorized' },
            {
                status: 401,
                statusText: 'Unauthorized',
            },
        );

        expect(receivedStatus).toBe(401);
        expect(authServiceMock.login).not.toHaveBeenCalled();
        expect(authServiceMock.logout).not.toHaveBeenCalled();

        httpMock.expectNone('/api/patients');
    });

    it('propagates 403 without logging out the user', () => {
        let receivedStatus: number | undefined;

        http.get('/api/doctors').subscribe({
            error: (error) => {
                receivedStatus = error.status;
            },
        });

        const request = httpMock.expectOne('/api/doctors');

        expect(request.request.headers.get('Authorization'))
            .toBe('Bearer test-access-token');

        request.flush(
            { title: 'Forbidden' },
            {
                status: 403,
                statusText: 'Forbidden',
            },
        );

        expect(receivedStatus).toBe(403);
        expect(authServiceMock.login).not.toHaveBeenCalled();
        expect(authServiceMock.logout).not.toHaveBeenCalled();
    });

    it('handles repeated 401 responses without retry loops', () => {
        const statuses: number[] = [];

        for (let i = 0; i < 3; i++) {
            http.get('/api/patients').subscribe({
                error: (error) => {
                    statuses.push(error.status);
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

            httpMock.expectNone('/api/patients');
        }

        expect(statuses).toEqual([401, 401, 401]);

        expect(authServiceMock.login).not.toHaveBeenCalled();
        expect(authServiceMock.logout).not.toHaveBeenCalled();

        expect(authServiceMock.getAccessToken)
            .toHaveBeenCalledTimes(3);
    });

    it('preserves network failures with both interceptors', () => {
        let receivedStatus: number | undefined;

        http.get('/api/appointments').subscribe({
            error: (error) => {
                receivedStatus = error.status;
            },
        });

        const request = httpMock.expectOne('/api/appointments');

        expect(request.request.headers.get('Authorization'))
            .toBe('Bearer test-access-token');

        request.error(new ProgressEvent('error'));

        expect(receivedStatus).toBe(0);
        expect(authServiceMock.login).not.toHaveBeenCalled();
        expect(authServiceMock.logout).not.toHaveBeenCalled();
    });
});