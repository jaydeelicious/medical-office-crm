import { inject, Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable } from 'rxjs';

const RETURN_URL_KEY = 'medicaloffice.auth.returnUrl';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly oidcSecurityService = inject(OidcSecurityService);

    readonly isAuthenticated$ = 
        this.oidcSecurityService.isAuthenticated$;

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
        ];

        return allowedPaths.includes(path);
    }

    getAccessToken(): Observable<string> {
        return this.oidcSecurityService.getAccessToken();
    }
}