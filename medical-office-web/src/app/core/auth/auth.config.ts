
import { LogLevel, OpenIdConfiguration } from 'angular-auth-oidc-client';

export const authConfig: OpenIdConfiguration = {
  authority: 'https://localhost:7234',
  clientId: 'medicaloffice-angular',
  redirectUrl: 'http://localhost:4200/auth/callback',
  postLoginRoute: '/auth/complete',
  postLogoutRedirectUri: 'http://localhost:4200/',
  scope: 'openid profile email offline_access',
  responseType: 'code',
  autoUserInfo: false,

  // Renew access tokens using refresh tokens.
  silentRenew: true,
  useRefreshToken: true,
  renewTimeBeforeTokenExpiresInSeconds: 60,

  logLevel: LogLevel.Warn,
};
