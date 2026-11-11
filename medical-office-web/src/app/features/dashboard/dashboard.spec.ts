
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

  const appointmentDate = (
    daysFromToday: number,
    time = '09:00:00',
  ): string => {
    const now = new Date();

    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysFromToday,
    );

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}T${time}`;
  };

  const mockUpcomingAppointments = (
    appointments: Appointment[],
  ): void => {
    appointmentServiceMock.getAll
      .mockReset()
      .mockReturnValueOnce(of([])) // Today
      .mockReturnValueOnce(of(appointments)); // Upcoming
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
  
  it('requests today and upcoming appointments separately', () => {
    createComponent();

    const calls = appointmentServiceMock.getAll.mock.calls;

    expect(calls).toHaveLength(2);

    expect(calls).toContainEqual([
      { date: appointmentDate(0).slice(0, 10) },
    ]);

    expect(calls).toContainEqual([]);

    completeHealthCheck();
  });

  it('displays only future scheduled appointments', () => {
    mockUpcomingAppointments([
      createAppointment('past', appointmentDate(-1)),
      createAppointment('today', appointmentDate(0)),
      createAppointment('future', appointmentDate(1)),
      createAppointment(
        'completed',
        appointmentDate(2),
        AppointmentStatus.Completed,
      ),
      createAppointment(
        'cancelled',
        appointmentDate(3),
        AppointmentStatus.Cancelled,
      ),
      createAppointment(
        'no-show',
        appointmentDate(4),
        AppointmentStatus.NoShow,
      ),
    ]);

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const upcomingPanel: HTMLElement =
      fixture.nativeElement.querySelector(
        '[aria-labelledby="upcoming-heading"]',
      );

    const rows = upcomingPanel.querySelectorAll(
      '.upcoming-appointment',
    );

    expect(rows).toHaveLength(1);

    const link = rows[0].querySelector(
      '.appointment-details-link',
    );

    expect(link?.getAttribute('href'))
      .toBe('/appointments/future');

    expect(upcomingPanel.textContent)
      .toContain('Scheduled');

    expect(upcomingPanel.textContent)
      .not.toContain('Cancelled');
  });

  it('sorts upcoming appointments chronologically', () => {
    mockUpcomingAppointments([
      createAppointment('latest', appointmentDate(5)),
      createAppointment('earliest', appointmentDate(1)),
      createAppointment('middle', appointmentDate(3)),
    ]);

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.upcoming-appointment .appointment-details-link',
      ),
    ) as HTMLAnchorElement[];

    expect(links.map((link) => link.getAttribute('href')))
      .toEqual([
        '/appointments/earliest',
        '/appointments/middle',
        '/appointments/latest',
      ]);
  });

  it('limits the upcoming list to five but counts all appointments', () => {
    const appointments = Array.from(
      { length: 8 },
      (_, index) =>
        createAppointment(
          `appointment-${index + 1}`,
          appointmentDate(index + 1),
        ),
    );

    mockUpcomingAppointments(appointments);

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const rows = element.querySelectorAll(
      '.upcoming-appointment',
    );

    expect(rows).toHaveLength(5);

    const cards = element.querySelectorAll('.stat-card');

    expect(
      cards[3].querySelector('.stat-value')
        ?.textContent?.trim(),
    ).toBe('8');

    expect(element.textContent)
      .toContain('Showing 5 of 8 upcoming appointments.');
  });

  it('displays upcoming patient and doctor information', () => {
    mockUpcomingAppointments([
      createAppointment(
        'appointment-1',
        appointmentDate(1, '10:30:00'),
      ),
    ]);

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const row: HTMLElement =
      fixture.nativeElement.querySelector(
        '.upcoming-appointment',
      );

    expect(row.textContent)
      .toContain('Maria Papadopoulou');

    expect(row.textContent)
      .toContain('Dr. Nikos Ioannou');

    expect(row.textContent)
      .toContain('Scheduled');

    expect(row.querySelector('.appointment-time')?.textContent)
      .toBeTruthy();

    expect(
      row.querySelector('.appointment-details-link')
        ?.getAttribute('href'),
    ).toBe('/appointments/appointment-1');
  });

  it('displays loading while upcoming appointments are fetched', () => {
    const pendingAppointments = new Subject<Appointment[]>();

    appointmentServiceMock.getAll
      .mockReset()
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(pendingAppointments.asObservable());

    const fixture = createComponent();

    const upcomingPanel: HTMLElement =
      fixture.nativeElement.querySelector(
        '[aria-labelledby="upcoming-heading"]',
      );

    expect(upcomingPanel.textContent)
      .toContain('Loading upcoming appointments...');

    pendingAppointments.next([]);
    pendingAppointments.complete();

    fixture.detectChanges();

    expect(upcomingPanel.textContent)
      .toContain('No upcoming appointments scheduled.');

    completeHealthCheck();
  });

  it('displays an empty state when no upcoming appointments exist', () => {
    mockUpcomingAppointments([]);

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const upcomingPanel: HTMLElement =
      fixture.nativeElement.querySelector(
        '[aria-labelledby="upcoming-heading"]',
      );

    expect(upcomingPanel.textContent)
      .toContain('No upcoming appointments scheduled.');

    expect(
      upcomingPanel.querySelectorAll('.upcoming-appointment'),
    ).toHaveLength(0);

    const cards = fixture.nativeElement.querySelectorAll(
      '.stat-card',
    );

    expect(
      cards[3].querySelector('.stat-value')
        ?.textContent?.trim(),
    ).toBe('0');
  });

  it('handles upcoming appointment API errors without affecting today', () => {
    appointmentServiceMock.getAll
      .mockReset()
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(
        throwError(() => new Error('API unavailable')),
      );

    const fixture = createComponent();
    completeHealthCheck();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const upcomingPanel = element.querySelector<HTMLElement>(
      '[aria-labelledby="upcoming-heading"]',
    );

    expect(upcomingPanel).not.toBeNull();

    expect(upcomingPanel?.textContent)
      .toContain('Unable to load upcoming appointments.');

    expect(upcomingPanel?.querySelector('[role="alert"]'))
      .not.toBeNull();

    const cards = element.querySelectorAll('.stat-card');

    expect(
      cards[3].querySelector('.stat-value')
        ?.textContent?.trim(),
    ).toBe('—');

    const todayPanel = element.querySelector<HTMLElement>(
      '[aria-labelledby="today-heading"]',
    );

    expect(todayPanel).not.toBeNull();

    expect(todayPanel?.textContent)
      .toContain('No appointments scheduled for today.');
  });
});
