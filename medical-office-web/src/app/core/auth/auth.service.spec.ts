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
});