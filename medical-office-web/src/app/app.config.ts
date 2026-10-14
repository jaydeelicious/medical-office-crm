
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';

import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { provideRouter } from '@angular/router';
import { 
  provideAuth,
  withAppInitializerAuthCheck,
} from 'angular-auth-oidc-client';

import { authConfig } from './core/auth/auth.config';
import { apiErrorInterceptor } from './core/http/api-error-interceptor';
import { routes } from './app.routes';

import { authTokenInterceptor } from './core/http/auth-token-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authTokenInterceptor,
        apiErrorInterceptor]),
    ),
    provideAuth(
      {
      config: authConfig,
      },
      withAppInitializerAuthCheck(),
    ),
  ],
};
