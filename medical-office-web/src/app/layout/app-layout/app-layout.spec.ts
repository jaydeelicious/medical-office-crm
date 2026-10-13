
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { BehaviorSubject, of } from 'rxjs';

import { AppLayout } from './app-layout';

describe('AppLayout authentication controls', () => {
  const authenticationState = new BehaviorSubject({
    isAuthenticated: false,
  });

  const oidcSecurityServiceMock = {
    authorize: vi.fn(),
    logoff: vi.fn().mockReturnValue(of({})),
    isAuthenticated$: authenticationState.asObservable(),
  };

  beforeEach(async () => {
    authenticationState.next({ isAuthenticated: false });
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [
        provideRouter([]),
        {
          provide: OidcSecurityService,
          useValue: oidcSecurityServiceMock,
        },
      ],
    }).compileComponents();
  });

  it('shows Login when unauthenticated', () => {
    const fixture = TestBed.createComponent(AppLayout);

    fixture.detectChanges();

    const loginButton =
      fixture.nativeElement.querySelector(
        'button.auth-button',
      ) as HTMLButtonElement;

    expect(loginButton.textContent).toContain('Login');
  });

  it('shows Logout when authenticated', () => {
    authenticationState.next({ isAuthenticated: true });

    const fixture = TestBed.createComponent(AppLayout);

    fixture.detectChanges();

    const logoutButton =
      fixture.nativeElement.querySelector(
        'button.auth-button',
      ) as HTMLButtonElement;

    expect(logoutButton.textContent).toContain('Logout');
  });

  it('starts authorization when Login is clicked', () => {
    const fixture = TestBed.createComponent(AppLayout);

    fixture.detectChanges();

    const loginButton =
      fixture.nativeElement.querySelector(
        'button.auth-button',
      ) as HTMLButtonElement;

    loginButton.click();

    expect(oidcSecurityServiceMock.authorize)
      .toHaveBeenCalledOnce();
  });

  it('starts logout when Logout is clicked', () => {
    authenticationState.next({ isAuthenticated: true });

    const fixture = TestBed.createComponent(AppLayout);

    fixture.detectChanges();

    const logoutButton =
      fixture.nativeElement.querySelector(
        'button.auth-button',
      ) as HTMLButtonElement;

    logoutButton.click();

    expect(oidcSecurityServiceMock.logoff)
      .toHaveBeenCalledOnce();
  });
});
