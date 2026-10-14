import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { BehaviorSubject, firstValueFrom, of, take } from 'rxjs';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authenticationState = new BehaviorSubject({
    isAuthenticated: false,
  });

  const oidcSecurityServiceMock = {
    isAuthenticated$: authenticationState.asObservable(),
    authorize: vi.fn(),
    logoff: vi.fn().mockReturnValue(of({})),
  };

  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();

    authenticationState.next({ isAuthenticated: false });
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: OidcSecurityService,
          useValue: oidcSecurityServiceMock,
        },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('exposes unauthenticated state', async () => {
    const state = await firstValueFrom(
      service.isAuthenticated$.pipe(take(1)),
    );

    expect(state.isAuthenticated).toBe(false);
  });

  it('reflects authentication state changes', async () => {
    authenticationState.next({ isAuthenticated: true });

    const state = await firstValueFrom(
      service.isAuthenticated$.pipe(take(1)),
    );

    expect(state.isAuthenticated).toBe(true);
  });

  it('initiates login', () => {
    service.login();

    expect(oidcSecurityServiceMock.authorize)
      .toHaveBeenCalledOnce();
  });

  it('initiates logout', () => {
    service.logout();

    expect(oidcSecurityServiceMock.logoff)
      .toHaveBeenCalledOnce();
  });

  it('saves the requested return URL before login', () => {
    service.login('/patients?tab=active');

    expect(oidcSecurityServiceMock.authorize)
      .toHaveBeenCalledOnce();

    expect(service.consumeReturnUrl())
      .toBe('/patients?tab=active');
  });

  it('uses dashboard when no return URL exists', () => {
    expect(service.consumeReturnUrl())
      .toBe('/dashboard');
  });

  it('rejects external return URLs', () => {
    service.login('//evil.example');

    expect(service.consumeReturnUrl())
      .toBe('/dashboard');
  });

  it('consumes the return URL only once', () => {
    service.login('/doctors');

    expect(service.consumeReturnUrl()).toBe('/doctors');
    expect(service.consumeReturnUrl()).toBe('/dashboard');
  });

  it('clears the pending return URL during logout', () => {
    service.login('/patients');
    service.logout();

    expect(service.consumeReturnUrl()).toBe('/dashboard');
  });

  it.each([
    '//evil.example',
    'https://evil.example',
    '/auth/callback',
    '/unknown-page',
    '/patients/../../evil',
    '/patients\\evil',
  ])('rejects unsafe return URL %s', (url) => {
    service.login(url);

    expect(service.consumeReturnUrl())
      .toBe('/dashboard');
  });

  it('preserves query parameters for allowed routes', () => {
    service.login('/patients?tab=active');

    expect(service.consumeReturnUrl())
      .toBe('/patients?tab=active');
  });
});