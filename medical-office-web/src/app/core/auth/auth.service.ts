import { inject, Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable } from 'rxjs';
import {
    catchError,
    map,
    of,
    switchMap,
} from 'rxjs';

const RETURN_URL_KEY = 'medicaloffice.auth.returnUrl';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly oidcSecurityService = inject(OidcSecurityService);

    readonly isAuthenticated$ = 
        this.oidcSecurityService.isAuthenticated$;

    readonly canViewAuditHistory$ = this.isAuthenticated$.pipe(
        switchMap(({ isAuthenticated }) => {
            if (!isAuthenticated) {
                return of(false);
            }

            return this.oidcSecurityService
                .getPayloadFromIdToken()
                .pipe(
                    map((payload: unknown) => {
                        if (
                            typeof payload !== 'object' ||
                            payload === null ||
                            Array.isArray(payload)
                        ) {
                            return false;
                        }

                        const claims = payload as Record<string, unknown>;
                        const roles = claims['role'];

                        if (typeof roles === 'string') {
                            return roles === 'Admin';
                        }

                        if (Array.isArray(roles)) {
                            return roles.includes('Admin');
                        }

                        return false;
                    }),
                    catchError(() => of(false)),
                );
        }),
    );

    login(returnUrl?: string): void {
        if (returnUrl && this.isSafeReturnUrl(returnUrl)) {
            sessionStorage.setItem(RETURN_URL_KEY, returnUrl);
        } else {
            sessionStorage.removeItem(RETURN_URL_KEY);
        }

        this.oidcSecurityService.authorize();
    }

    logout(): void {
        sessionStorage.removeItem(RETURN_URL_KEY);
        this.oidcSecurityService.logoff().subscribe();
    }

    consumeReturnUrl(): string {
        const returnUrl = sessionStorage.getItem(RETURN_URL_KEY);
        sessionStorage.removeItem(RETURN_URL_KEY);

        if (returnUrl && this.isSafeReturnUrl(returnUrl)) {
            return returnUrl;
        }

        return '/dashboard';
    }

    private isSafeReturnUrl(url: string): boolean {
        const hasControlCharacters = [...url].some((char) => {
            const code = char.charCodeAt(0);

            return code <= 31 || code === 127;
        });

        if (url.includes('\\') || hasControlCharacters) {
            return false;
        }
        
        const path = url.split(/[?#]/, 1)[0];

        const allowedPaths = [
            '/dashboard',
            '/patients',
            '/doctors',
            '/appointments',
            '/audit-history',
        ];

        return allowedPaths.includes(path);
    }

    getAccessToken(): Observable<string> {
        return this.oidcSecurityService.getAccessToken();
    }
}