import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
    selector: 'app-auth-complete',
    template: '<p>Completing sign-in...</p>',
})
export class AuthComplete implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    ngOnInit(): void {
        this.authService.isAuthenticated$
            .pipe(take(1))
            .subscribe(({ isAuthenticated }) => {
                if (isAuthenticated) {
                    const returnUrl = this.authService.consumeReturnUrl();

                    void this.router.navigateByUrl(returnUrl, {
                        replaceUrl: true,
                    });
                } else {
                    void this.router.navigateByUrl('/', {
                        replaceUrl: true,
                    });
                }
            });
    }
}