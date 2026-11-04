
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BehaviorSubject } from 'rxjs';

import { AppLayout } from './app-layout';

describe('AppLayout authentication controls', () => {
  const authenticationState = new BehaviorSubject({
    isAuthenticated: false,
  });

  const auditVisibility = new BehaviorSubject(false);

  const authServiceMock = {
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated$: authenticationState.asObservable(),
    canViewAuditHistory$: auditVisibility.asObservable(),
  };

  beforeEach(async () => {
    authenticationState.next({ isAuthenticated: false });
    auditVisibility.next(false);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authServiceMock,
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

    expect(authServiceMock.login)
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

    expect(authServiceMock.logout)
      .toHaveBeenCalledOnce();
  });

  it('hides audit history from non-admin users', () => {
    authenticationState.next({
      isAuthenticated: true,
    });

    auditVisibility.next(false);

    const fixture = TestBed.createComponent(AppLayout);
    fixture.detectChanges();

    const auditLink = fixture.nativeElement.querySelector(
      'a[href="/audit-history"]',
    );

    expect(auditLink).toBeNull();
  });

  it('shows audit history to administrators', () => {
    authenticationState.next({
      isAuthenticated: true,
    });

    auditVisibility.next(true);

    const fixture = TestBed.createComponent(AppLayout);
    fixture.detectChanges();

    const auditLink = fixture.nativeElement.querySelector(
      'a[href="/audit-history"]',
    ) as HTMLAnchorElement;

    expect(auditLink).not.toBeNull();
    expect(auditLink.textContent).toContain('Audit History');
  });

  it('updates audit navigation when permissions change', () => {
    authenticationState.next({
      isAuthenticated: true,
    });

    const fixture = TestBed.createComponent(AppLayout);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        'a[href="/audit-history"]',
      ),
    ).toBeNull();

    auditVisibility.next(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        'a[href="/audit-history"]',
      ),
    ).not.toBeNull();

    auditVisibility.next(false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        'a[href="/audit-history"]',
      ),
    ).toBeNull();
  });
});
