
import { LogLevel, OpenIdConfiguration } from 'angular-auth-oidc-client';

export const authConfig: OpenIdConfiguration = {
  authority: 'https://localhost:7234',
  clientId: 'medicaloffice-angular',
  redirectUrl: 'http://localhost:4200/auth/callback',
  postLogoutRedirectUri: 'http://localhost:4200/',
  scope: 'openid profile email offline_access',
  responseType: 'code',
  autoUserInfo: false,
  silentRenew: false,
  logLevel: LogLevel.Warn,
};
