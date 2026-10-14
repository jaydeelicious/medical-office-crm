
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BehaviorSubject, of } from 'rxjs';

import { AppLayout } from './app-layout';

describe('AppLayout authentication controls', () => {
  const authenticationState = new BehaviorSubject({
    isAuthenticated: false,
  });

  const authServiceMock = {
    login: vi.fn(),
    logout: vi.fn(),
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
});
