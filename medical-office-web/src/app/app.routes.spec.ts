
import { TestBed } from '@angular/core/testing';
import { AuthService } from './core/auth/auth.service';
import {
  NavigationEnd,
  provideRouter,
  Router,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  BehaviorSubject, 
  filter, 
  firstValueFrom,
} from 'rxjs';

import { routes } from './app.routes';

describe('Application routing', () => {
  const authenticationState = new BehaviorSubject({
    isAuthenticated: true,
  });

  const authServiceMock = {
    isAuthenticated$: authenticationState.asObservable(),
    login: vi.fn(),
    logout: vi.fn(),
    consumeReturnUrl: vi.fn().mockReturnValue('/dashboard'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    authenticationState.next({ isAuthenticated: true });

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    });
  });

  it('redirects the root URL to dashboard', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/');

    expect(router.url).toBe('/dashboard');
  }, 20000);

  it('renders each application route', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    const pages = [
      { path: '/dashboard', title: 'Dashboard' },
      { path: '/patients', title: 'Patients' },
      { path: '/doctors', title: 'Doctors' },
      { path: '/appointments', title: 'Appointments' },
    ];

    for (const page of pages) {
      await harness.navigateByUrl(page.path);

      expect(router.url).toBe(page.path);
      expect(harness.routeNativeElement?.textContent)
        .toContain(page.title);
    }
  }, 30000);

  it('displays the Not Found page for unknown routes', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/unknown-page');

    expect(harness.routeNativeElement?.textContent)
      .toContain('Page not found');
  }, 20000);

  it('navigates between pages using RouterLink', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/dashboard');

    const patientsLink = harness.routeNativeElement
      ?.querySelector<HTMLAnchorElement>(
        'a.nav-link[href="/patients"]'
      );

    expect(patientsLink).not.toBeNull();

    const navigationCompleted = firstValueFrom(
      router.events.pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd
        ),
      ),
    );

    patientsLink?.click();

    await navigationCompleted;
    harness.detectChanges();

    expect(router.url).toBe('/patients');
    expect(harness.routeNativeElement?.textContent)
      .toContain('Patients');
  }, 20000);

  it.each([
    '/dashboard',
    '/patients',
    '/patients/new',
    '/patients/8d98f074-b491-4e62-8519-d1f197c1a12e',
    '/patients/8d98f074-b491-4e62-8519-d1f197c1a12e/edit',
    '/doctors',
    '/doctors/new',
    '/doctors/8d98f074-b491-4e62-8519-d1f197c1a12e',
    '/doctors/8d98f074-b491-4e62-8519-d1f197c1a12e/edit',
    '/appointments',
  ])('blocks unauthenticated navigation to %s', async (path) => {
    authenticationState.next({ isAuthenticated: false });

    const router = TestBed.inject(Router);

    const result = await router.navigateByUrl(path);

    expect(result).toBe(false);

    expect(authServiceMock.login)
      .toHaveBeenCalledOnce();

    expect(authServiceMock.login)
      .toHaveBeenCalledWith(path);
  });

  it('preserves query parameters for unauthenticated deep links', async () => {
    authenticationState.next({ isAuthenticated: false });

    const router = TestBed.inject(Router);

    const result = await router.navigateByUrl(
      '/patients?tab=active&sort=name',
    );

    expect(result).toBe(false);

    expect(authServiceMock.login).toHaveBeenCalledWith(
      '/patients?tab=active&sort=name',
    );
  });

  it('allows unauthenticated access to the callback route', async () => {
    authenticationState.next({ isAuthenticated: false });

    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/auth/callback');

    expect(harness.routeNativeElement?.textContent)
      .toContain('Completing sign-in...');

    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('does not invoke login for the public completion route', async () => {
    authenticationState.next({ isAuthenticated: false });

    const router = TestBed.inject(Router);

    await router.navigateByUrl('/auth/complete');

    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('keeps authentication routes outside the protected layout', () => {
    const layoutRoute = routes.find(
      (route) => route.path === '' && route.children,
    );

    const callbackRoute = routes.find(
      (route) => route.path === 'auth/callback',
    );

    const completeRoute = routes.find(
      (route) => route.path === 'auth/complete',
    );

    expect(layoutRoute?.canActivateChild).toBeDefined();

    expect(callbackRoute?.canActivate).toBeUndefined();
    expect(callbackRoute?.canActivateChild).toBeUndefined();

    expect(completeRoute?.canActivate).toBeUndefined();
    expect(completeRoute?.canActivateChild).toBeUndefined();

    expect(
      layoutRoute?.children?.some(
        (route) =>
          route.path === 'auth/callback' ||
          route.path === 'auth/complete',
      ),
    ).toBe(false);
  });
  
  it('displays Not Found without requiring authentication', async () => {
    authenticationState.next({ isAuthenticated: false });

    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/unknown-page');

    expect(harness.routeNativeElement?.textContent)
      .toContain('Page not found');

    expect(authServiceMock.login)
      .not.toHaveBeenCalled();
  });

  it('preserves the full doctor edit URL when authentication is required', async () => {
    authenticationState.next({ isAuthenticated: false });

    const router = TestBed.inject(Router);
    const url = '/doctors/8d98f074-b491-4e62-8519-d1f197c1a12e/edit?source=dashboard';

    const result = await router.navigateByUrl(url);

    expect(result).toBe(false);
    expect(authServiceMock.login).toHaveBeenCalledWith(url);
  });

  it('registers the new appointment route before the details route', () => {
        const layoutRoute = routes.find(
            (route) => route.path === '' && route.children,
        );

        const children = layoutRoute?.children ?? [];

        const newAppointmentIndex = children.findIndex(
            (route) => route.path === 'appointments/new',
        );

        const appointmentDetailsIndex = children.findIndex(
            (route) => route.path === 'appointments/:id',
        );

        expect(newAppointmentIndex).toBeGreaterThanOrEqual(0);
        expect(appointmentDetailsIndex).toBeGreaterThanOrEqual(0);

        expect(newAppointmentIndex).toBeLessThan(
            appointmentDetailsIndex,
        );
    });
});
