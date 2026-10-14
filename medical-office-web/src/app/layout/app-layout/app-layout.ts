import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
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
  LucideLogOut,
} from '@lucide/angular';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-app-layout',
  imports: [
    AsyncPipe,
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
    LucideLogOut,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss'
})
export class AppLayout {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly isAuthenticated$ = 
    this.authService.isAuthenticated$;

  protected login(): void {
    this.authService.login();
  }

  protected logout(): void {
    this.authService.logout();
  }

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
}