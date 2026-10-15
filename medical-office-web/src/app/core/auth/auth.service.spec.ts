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
    getAccessToken: vi.fn().mockReturnValue(of('test-access-token')),
  };

  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();

    authenticationState.next({ isAuthenticated: false });
    vi.clearAllMocks();

    oidcSecurityServiceMock.getAccessToken.mockReturnValue(
      of('test-access-token'),
    );

    oidcSecurityServiceMock.logoff.mockReturnValue(
      of({}),
    );

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

  it('retrieves the access token from the OIDC library', async () => {
    const token = await firstValueFrom(service.getAccessToken());

    expect(token).toBe('test-access-token');

    expect(oidcSecurityServiceMock.getAccessToken)
      .toHaveBeenCalledOnce();
  });

  it('emits authentication state changes to subscribers', () => {
    const receivedStates: boolean[] = [];

    const subscription = service.isAuthenticated$.subscribe(
      ({ isAuthenticated }) => {
        receivedStates.push(isAuthenticated);
      },
    );

    authenticationState.next({ isAuthenticated: true });
    authenticationState.next({ isAuthenticated: false });

    expect(receivedStates).toEqual([
      false,
      true,
      false,
    ]);

    subscription.unsubscribe();
  });

  it('clears a previous return URL when login has no destination', () => {
    service.login('/patients');

    service.login();

    expect(service.consumeReturnUrl())
      .toBe('/dashboard');

    expect(oidcSecurityServiceMock.authorize)
      .toHaveBeenCalledTimes(2);
  });

  it('clears a previous return URL when a new destination is unsafe', () => {
    service.login('/patients');

    service.login('https://evil.example');

    expect(service.consumeReturnUrl())
      .toBe('/dashboard');
  });

  it.each([
    '/patients\nexample',
    '/patients\r\nexample',
    '/patients\texample',
    '/patients\u0000example',
    '/patients\u007Fexample',
  ])('rejects return URLs containing control characters', (url) => {
    service.login(url);

    expect(service.consumeReturnUrl())
      .toBe('/dashboard');
  });

  it('does not invoke logout until requested', () => {
    expect(oidcSecurityServiceMock.logoff)
      .not.toHaveBeenCalled();

    service.logout();

    expect(oidcSecurityServiceMock.logoff)
      .toHaveBeenCalledOnce();
  });

  it('returns an empty access token when none is available', async () => {
    oidcSecurityServiceMock.getAccessToken
      .mockReturnValueOnce(of(''));

    const token = await firstValueFrom(
      service.getAccessToken(),
    );

    expect(token).toBe('');
  });

  it('preserves fragments for approved application routes', () => {
    service.login('/appointments#calendar');

    expect(service.consumeReturnUrl())
      .toBe('/appointments#calendar');
  });
});