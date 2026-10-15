
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { routes } from '../../../app.routes';

describe('AuthCallback routing', () => {
  const authServiceMock = {
    isAuthenticated$: of({ isAuthenticated: false }),
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

  it('allows unauthenticated access to the OIDC callback route', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/auth/callback');

    expect(harness.routeNativeElement?.textContent)
      .toContain('Completing sign-in...');

    expect(authServiceMock.login)
      .not.toHaveBeenCalled();
  });
});
