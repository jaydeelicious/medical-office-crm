import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./layout/app-layout/app-layout').then(
                (m) => m.AppLayout
            ),
        canActivateChild: [authGuard],
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
                path: 'patients/new',
                loadComponent: () =>
                    import('./features/patients/patient-form/patient-form').then(
                        (m) => m.PatientForm
                    ),
            },
            {
                path: 'patients/:id/edit',
                loadComponent: () =>
                    import('./features/patients/patient-form/patient-form').then(
                        (m) => m.PatientForm
                    ),
            },
            {
                path: 'patients/:id',
                loadComponent: () =>
                    import('./features/patients/patient-details/patient-details').then(
                        (m) => m.PatientDetails
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
                path: 'doctors/new',
                loadComponent: () =>
                    import('./features/doctors/doctor-form/doctor-form').then(
                        (m) => m.DoctorForm
                    ),
            },
            {
                path: 'doctors/:id/edit',
                loadComponent: () =>
                    import('./features/doctors/doctor-form/doctor-form').then(
                        (m) => m.DoctorForm
                    ),
            },
            {
                path: 'doctors/:id',
                loadComponent: () =>
                    import('./features/doctors/doctor-details/doctor-details').then(
                        (m) => m.DoctorDetails
                    ),
            },
            {
                path: 'appointments',
                loadComponent: () =>
                    import('./features/appointments/appointments').then(
                        (m) => m.Appointments
                    ),
            },
            {
                path: 'appointments/:id',
                loadComponent: () =>
                    import('./features/appointments/appointment-details/appointment-details')
                        .then((m) => m.AppointmentDetails),
            },
        ],
    },
    {
        path: 'auth/callback',
        loadComponent: () =>
            import('./features/auth/callback/auth-callback').then(
            (m) => m.AuthCallback
            ),
    },
    {
        path: 'auth/complete',
        loadComponent: () => 
            import('./features/auth/complete/auth-complete').then(
                (m) => m.AuthComplete
            ),
    },
    {
        path: '**',
        loadComponent: () =>
            import('./features/not-found/not-found').then(
                (m) => m.NotFound
            ),
    },
];
