import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, take } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

function isTrustedApiUrl(url: string): boolean {
    const apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');

    // Our Angular application uses the same-origin /api proxy.
    if (apiBaseUrl !== '/api') {
        return false;
    }

    // Only allow  canonical root-relative API URLs.
    if (
        !url.startsWith('/api/') ||
        url.includes('\\')
    ) {
        return false;
    }

    const parsedUrl = new URL(url, document.baseURI);

    if (parsedUrl.origin !== window.location.origin ||
        parsedUrl.pathname.includes('%') ||
        url.split(/[?#]/, 1)[0].includes('%')
    ) {
        return false;
    }

    const path = parsedUrl.pathname.toLowerCase();

    // A public endpoint should not receive credentials.
    if (path == '/api/health') {
        return false;
    }

    const trustedPaths = [
        '/api/patients',
        '/api/doctors',
        '/api/appointments'
    ];

    return trustedPaths.some(
        (trustedPath) =>
            path == trustedPath || 
        path.startsWith(`${trustedPath}/`),
    );
}

export const authTokenInterceptor : HttpInterceptorFn = (
    request, 
    next, 
) => {
    if (!isTrustedApiUrl(request.url)) {
        return next(request);
    }

    const authService = inject(AuthService);

    return authService.getAccessToken().pipe(
        take(1),
        switchMap((token) => {
            if (!token) {
                return next(request);
            }

            const authenticatedRequest = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`,
                },
            });

            return next(authenticatedRequest);
        }),
    );
};