
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Dashboard } from './dashboard';
import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';
import { AppointmentService } from '../appointments/appointment.service';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/appointment.model';

describe('Dashboard', () => {
  let httpMock: HttpTestingController;

  const patientServiceMock = {
    getAll: vi.fn(),
  };

  const doctorServiceMock = {
    getAll: vi.fn(),
  };

  const appointmentServiceMock = {
    getAll: vi.fn(),
  };

  const createAppointment = (
    id: string,
    startTime: string,
    status = AppointmentStatus.Scheduled,
  ): Appointment => ({
    id,
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    startTime,
    endTime: startTime.replace(':00', ':30'),
    status,
    notes: null,
    rowVersion: 'test-version',
  });

  const createComponent = () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return fixture;
  };

  const completeHealthCheck = () => {
    httpMock.expectOne('/api/health').flush({
      status: 'Healthy',
    });
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    patientServiceMock.getAll.mockReturnValue(
      of([
        {
          id: 'patient-1',
          firstName: 'Maria',
          lastName: 'Papadopoulou',
        },
      ]),
    );

    doctorServiceMock.getAll.mockReturnValue(
      of([
        {
          id: 'doctor-1',
          firstName: 'Nikos',
          lastName: 'Ioannou',
        },
      ]),
    );

    appointmentServiceMock.getAll.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PatientService,
          useValue: patientServiceMock,
        },
        {
          provide: DoctorService,
          useValue: doctorServiceMock,
        },
        {
          provide: AppointmentService,
          useValue: appointmentServiceMock,
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('displays checking before the API responds', () => {
    const fixture = createComponent();

    expect(fixture.nativeElement.textContent)
      .toContain('Checking API...');

    completeHealthCheck();
  });

  it('displays connected when the API is healthy', () => {
    const fixture = createComponent();

    completeHealthCheck();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('API Connected');
  });

  it('displays unavailable when the API request fails', () => {
    const fixture = createComponent();

    httpMock.expectOne('/api/health').flush(
      { title: 'Service Unavailable' },
      {
        status: 503,
        statusText: 'Service Unavailable',
      },
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('API Unavailable');
  });

  it('renders the dashboard overview and sections', () => {
    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('h1')?.textContent)
      .toContain('Dashboard');

    expect(element.querySelectorAll('.stat-card'))
      .toHaveLength(4);

    expect(element.textContent)
      .toContain('Total Patients');

    expect(element.textContent)
      .toContain('Active Doctors');

    expect(element.textContent)
      .toContain("Today's Appointments");

    expect(element.textContent)
      .toContain('Upcoming Appointments');

    expect(element.querySelectorAll('.dashboard-panel'))
      .toHaveLength(2);
  });

  it('displays patient and doctor totals', () => {
    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const cards = fixture.nativeElement
      .querySelectorAll('.stat-card');

    expect(cards[0].querySelector('.stat-value')
      .textContent.trim()).toBe('1');

    expect(cards[1].querySelector('.stat-value')
      .textContent.trim()).toBe('1');
  });

  it('requests appointments for the local current date', () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const expectedDate = `${year}-${month}-${day}`;

    createComponent();

    expect(appointmentServiceMock.getAll)
      .toHaveBeenCalledWith({
        date: expectedDate,
      });

    completeHealthCheck();
  });

  it('displays loading while appointments are being fetched', () => {
    const pendingAppointments = new Subject<Appointment[]>();

    appointmentServiceMock.getAll.mockReturnValue(
      pendingAppointments.asObservable(),
    );

    const fixture = createComponent();

    expect(fixture.nativeElement.textContent)
      .toContain("Loading today's appointments...");

    pendingAppointments.next([]);
    pendingAppointments.complete();

    completeHealthCheck();
  });

  it('displays patient, doctor and appointment status', () => {
    appointmentServiceMock.getAll.mockReturnValue(
      of([
        createAppointment(
          'appointment-1',
          '2026-11-10T09:00:00',
          AppointmentStatus.Scheduled,
        ),
        createAppointment(
          'appointment-2',
          '2026-11-10T11:00:00',
          AppointmentStatus.Completed,
        ),
      ]),
    );

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const rows = fixture.nativeElement
      .querySelectorAll('.today-appointment');

    expect(rows).toHaveLength(2);

    expect(rows[0].textContent)
      .toContain('Maria Papadopoulou');

    expect(rows[0].textContent)
      .toContain('Dr. Nikos Ioannou');

    expect(rows[0].textContent)
      .toContain('Scheduled');

    expect(rows[1].textContent)
      .toContain('Completed');
  });

  it('sorts today appointments chronologically', () => {
    appointmentServiceMock.getAll.mockReturnValue(
      of([
        createAppointment('late', '2026-11-10T15:00:00'),
        createAppointment('early', '2026-11-10T09:00:00'),
        createAppointment('middle', '2026-11-10T12:00:00'),
      ]),
    );

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.appointment-details-link',
      ),
    ) as HTMLAnchorElement[];

    expect(links.map((link) => link.getAttribute('href')))
      .toEqual([
        '/appointments/early',
        '/appointments/middle',
        '/appointments/late',
      ]);
  });

  it('displays the correct appointment count', () => {
    appointmentServiceMock.getAll.mockReturnValue(
      of([
        createAppointment('a1', '2026-11-10T09:00:00'),
        createAppointment('a2', '2026-11-10T10:00:00'),
        createAppointment('a3', '2026-11-10T11:00:00'),
      ]),
    );

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const cards = fixture.nativeElement
      .querySelectorAll('.stat-card');

    expect(cards[2].querySelector('.stat-value')
      .textContent.trim()).toBe('3');
  });

  it('displays an empty state when no appointments exist', () => {
    const fixture = createComponent();

    completeHealthCheck();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('No appointments scheduled for today.');

    expect(fixture.nativeElement.querySelectorAll(
      '.today-appointment',
    )).toHaveLength(0);
  });

  it('displays an error when appointments cannot load', () => {
    appointmentServiceMock.getAll.mockReturnValue(
      throwError(() => new Error('API unavailable')),
    );

    const fixture = createComponent();

    completeHealthCheck();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent)
      .toContain("Unable to load today's appointments.");

    expect(element.querySelector('[role="alert"]'))
      .not.toBeNull();

    const cards = element.querySelectorAll('.stat-card');

    expect(cards[2].querySelector('.stat-value')
      ?.textContent?.trim()).toBe('—');
  });

  it('links to the correct appointment details page', () => {
    appointmentServiceMock.getAll.mockReturnValue(
      of([
        createAppointment(
          'appointment-123',
          '2026-11-10T09:00:00',
        ),
      ]),
    );

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const link: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector(
        '.appointment-details-link',
      );

    expect(link).not.toBeNull();

    expect(link?.getAttribute('href'))
      .toBe('/appointments/appointment-123');
  });
});
