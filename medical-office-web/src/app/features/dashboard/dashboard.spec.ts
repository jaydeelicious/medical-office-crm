
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { Dashboard } from './dashboard';

import { of } from 'rxjs';
import { PatientService } from '../patients/patient.service';
import { DoctorService } from '../doctors/doctor.service';

describe('Dashboard', () => {
  let httpMock: HttpTestingController;

  const patientServiceMock = {
    getAll: vi.fn(),
  };

  const doctorServiceMock = {
    getAll: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    patientServiceMock.getAll.mockReturnValue(of([]));
    doctorServiceMock.getAll.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PatientService,
          useValue: patientServiceMock,
        },
        {
          provide: DoctorService,
          useValue: doctorServiceMock,
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('displays checking before the API responds', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Checking API...');

    httpMock.expectOne('/api/health').flush({
      status: 'Healthy',
    });
  });

  it('displays connected when the API is healthy', () => {
    const fixture = TestBed.createComponent(Dashboard);

    const request = httpMock.expectOne('/api/health');
    request.flush({ status: 'Healthy' });

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('API Connected');
  });

  it('displays unavailable when the API request fails', () => {
    const fixture = TestBed.createComponent(Dashboard);

    const request = httpMock.expectOne('/api/health');

    request.flush(
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

  it('renders the dashboard overview and appointment sections', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    // Complete the health request before making assertions.
    httpMock.expectOne('/api/health').flush({
      status: 'Healthy',
    });

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('h1')?.textContent)
      .toContain('Dashboard');

    expect(element.querySelectorAll('.stat-card').length)
      .toBe(4);

    expect(element.textContent)
      .toContain('Total Patients');

    expect(element.textContent)
      .toContain('Active Doctors');

    expect(element.textContent)
      .toContain("Today's Appointments");

    expect(element.textContent)
      .toContain('Upcoming Appointments');

    expect(element.querySelectorAll('.dashboard-panel').length)
      .toBe(2);
  });

  it('displays patient and doctor totals', () => {
    patientServiceMock.getAll.mockReturnValue(
      of([{}, {}, {}]),
    );

    doctorServiceMock.getAll.mockReturnValue(
      of([{}, {}]),
    );

    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    const cards = fixture.nativeElement
      .querySelectorAll('.stat-card');

    expect(cards[0].textContent).toContain('Total Patients');
    expect(cards[0].querySelector('.stat-value').textContent.trim())
      .toBe('3');

    expect(cards[1].textContent).toContain('Active Doctors');
    expect(cards[1].querySelector('.stat-value').textContent.trim())
      .toBe('2');

    httpMock.expectOne('/api/health').flush({
      status: 'Healthy',
    });
  });
});
