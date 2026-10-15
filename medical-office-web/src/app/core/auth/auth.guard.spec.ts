import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

import { Component } from '@angular/core';

@Component({
    template: '',
})
class TestPage {}

describe('authGuard', () => {
  const authServiceMock = {
    isAuthenticated$: of({ isAuthenticated: false }),
    login: vi.fn(),
  };

  let router: Router;

  beforeEach(() => {
    vi.clearAllMocks();

    authServiceMock.isAuthenticated$ = of({
      isAuthenticated: false,
    });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'patients',
            canActivate: [authGuard],
            children: [
              {
                path: '',
                component: TestPage,
              },
            ],
          },
        ]),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('allows navigation when authenticated', async () => {
    authServiceMock.isAuthenticated$ = of({
      isAuthenticated: true,
    });

    const result = await router.navigateByUrl('/patients');

    expect(result).toBe(true);
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('blocks navigation when unauthenticated', async () => {
    const result = await router.navigateByUrl('/patients');

    expect(result).toBe(false);
    expect(authServiceMock.login).toHaveBeenCalledOnce();
  });

  it('blocks navigation and preserves the requested URL', async () => {
    const result = await router.navigateByUrl(
      '/patients?tab=active',
    );

    expect(result).toBe(false);

    expect(authServiceMock.login)
      .toHaveBeenCalledWith('/patients?tab=active');
  });
});