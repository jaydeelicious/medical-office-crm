import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthComplete } from './auth-complete';

describe('AuthComplete', () => {
  const authServiceMock = {
    isAuthenticated$: of({ isAuthenticated: true }),
    consumeReturnUrl: vi.fn().mockReturnValue('/patients'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    authServiceMock.isAuthenticated$ =
      of({ isAuthenticated: true });

    await TestBed.configureTestingModule({
      imports: [AuthComplete],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compileComponents();
  });

  it('restores the requested route after authentication', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    const fixture = TestBed.createComponent(AuthComplete);
    fixture.detectChanges();

    expect(authServiceMock.consumeReturnUrl)
      .toHaveBeenCalledOnce();

    expect(navigateSpy).toHaveBeenCalledWith(
      '/patients',
      { replaceUrl: true },
    );
  });

  it('does not consume the return URL when unauthenticated', () => {
    authServiceMock.isAuthenticated$ =
      of({ isAuthenticated: false });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    const fixture = TestBed.createComponent(AuthComplete);
    fixture.detectChanges();

    expect(authServiceMock.consumeReturnUrl)
      .not.toHaveBeenCalled();

    expect(navigateSpy).toHaveBeenCalledWith(
      '/',
      { replaceUrl: true },
    );
  });
});