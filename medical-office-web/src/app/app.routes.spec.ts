
import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import {
  NavigationEnd,
  provideRouter,
  Router,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { of } from 'rxjs';

import { routes } from './app.routes';

describe('Application routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
            provide: OidcSecurityService,
            useValue: {
                authorize: vi.fn(),
                logoff: vi.fn().mockReturnValue(of({})),
                isAuthenticated$: of({ isAuthenticated: false }),
            },
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
});
