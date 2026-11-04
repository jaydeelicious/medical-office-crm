
import {
  LogLevel,
  OpenIdConfiguration,
} from 'angular-auth-oidc-client';

import { getRuntimeConfig } from './runtime-config';

const runtimeConfig = getRuntimeConfig();

const origin = window.location.origin;

export const authConfig: OpenIdConfiguration = {
  authority: runtimeConfig.authority,

  clientId: 'medicaloffice-angular',

  redirectUrl: `${origin}/auth/callback`,

  postLoginRoute: '/auth/complete',

  postLogoutRedirectUri: `${origin}/`,

  scope: 'openid profile email offline_access',

  responseType: 'code',

  autoUserInfo: false,

  silentRenew: true,
  useRefreshToken: true,
  renewTimeBeforeTokenExpiresInSeconds: 60,

  logLevel: LogLevel.Warn,
};
