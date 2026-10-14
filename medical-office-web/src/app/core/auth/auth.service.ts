import { inject, Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly oidcSecurityService = inject(OidcSecurityService);

    readonly isAuthenticated$ = 
        this.oidcSecurityService.isAuthenticated$;

    login(): void {
        this.oidcSecurityService.authorize();
    }

    logout(): void {
        this.oidcSecurityService.logoff().subscribe();
    }
}