import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./layout/app-layout/app-layout').then(
                (m) => m.AppLayout
            ),
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'dashboard',
            },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./features/dashboard/dashboard').then(
                        (m) => m.Dashboard
                    ),
            },
            {
                path: 'patients',
                loadComponent: () =>
                    import('./features/patients/patients').then(
                        (m) => m.Patients
                    ),
            },
            {
                path: 'doctors',
                loadComponent: () =>
                    import('./features/doctors/doctors').then(
                        (m) => m.Doctors
                    ),
            },
            {
                path: 'appointments',
                loadComponent: () =>
                    import('./features/appointments/appointments').then(
                        (m) => m.Appointments
                    ),
            },
        ],
    },
    {
        path: '**',
        loadComponent: () =>
            import('./features/not-found/not-found').then(
                (m) => m.NotFound
            ),
    },
];
