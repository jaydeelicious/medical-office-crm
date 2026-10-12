import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  LucideHeartPulse,
  LucideLayoutDashboard,
  LucideUsersRound,
  LucideStethoscope,
  LucideCalendarDays,
  LucideCircleUserRound,
  LucideMenu,
  LucideLogIn,
} from '@lucide/angular';
import { filter } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Component({
  selector: 'app-app-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideHeartPulse,
    LucideLayoutDashboard,
    LucideUsersRound,
    LucideStethoscope,
    LucideCalendarDays,
    LucideCircleUserRound,
    LucideMenu,
    LucideLogIn,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss'
})
export class AppLayout {
  private readonly router = inject(Router);
  private readonly oidcSecurityService = inject(OidcSecurityService);

  protected readonly menuOpen = signal(false);
  protected readonly pageTitle = signal('Dashboard');

  protected readonly navigation = [
    { 
      label: 'Dashboard',
      path: '/dashboard',
    },
    { 
      label: 'Patients', 
      path: '/patients', 
    },
    { 
      label: 'Doctors', 
      path: '/doctors',
    },
    { 
      label: 'Appointments', 
      path: '/appointments', 
    },
  ];

  constructor() {
    this.updatePageTitle();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        this.updatePageTitle();
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  private updatePageTitle(): void {
    const path = this.router.url.split(/[?#]/)[0];
    const current = this.navigation.find((item) => item.path == path);

    this.pageTitle.set(current?.label ?? 'Dashboard');
  }

  protected login(): void {
    this.oidcSecurityService.authorize();
  }
}