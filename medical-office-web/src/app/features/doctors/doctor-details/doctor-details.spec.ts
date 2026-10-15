
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Doctor } from '../doctor.model';
import { DoctorService } from '../doctor.service';
import { DoctorDetails } from './doctor-details';

describe('DoctorDetails', () => {
  let fixture: ComponentFixture<DoctorDetails>;
  let component: DoctorDetails;

  const doctor: Doctor = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    firstName: 'Jane',
    lastName: 'Smith',
    specialty: 'Cardiology',
    email: 'jane@example.com',
    phone: '2101234567',
  };

  const doctorServiceMock = {
    getById: vi.fn(),
  };

  const routeMock = {
    snapshot: {
      paramMap: convertToParamMap({ id: doctor.id }),
    },
  };

  beforeEach(async () => {
    doctorServiceMock.getById.mockReset();
    routeMock.snapshot.paramMap = convertToParamMap({
      id: doctor.id,
    });

    await TestBed.configureTestingModule({
      imports: [DoctorDetails],
      providers: [
        provideRouter([]),
        {
          provide: DoctorService,
          useValue: doctorServiceMock,
        },
        {
          provide: ActivatedRoute,
          useValue: routeMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorDetails);
    component = fixture.componentInstance;
  });

  it('should load and display doctor details', () => {
    doctorServiceMock.getById.mockReturnValue(of(doctor));

    fixture.detectChanges();

    expect(doctorServiceMock.getById).toHaveBeenCalledWith(
      doctor.id,
    );
    expect(component.doctor()).toEqual(doctor);

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Jane Smith');
    expect(text).toContain('Cardiology');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('2101234567');
  });

  it('should display loading state', () => {
    const response = new Subject<Doctor>();

    doctorServiceMock.getById.mockReturnValue(
      response.asObservable(),
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);

    expect(
      fixture.nativeElement.querySelector(
        'app-loading-indicator',
      ),
    ).not.toBeNull();

    response.complete();
  });

  it('should handle a missing doctor ID', () => {
    routeMock.snapshot.paramMap = convertToParamMap({});

    fixture.detectChanges();

    expect(doctorServiceMock.getById).not.toHaveBeenCalled();
    expect(component.doctor()).toBeNull();
    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'No doctor ID was provided.',
    );
  });

  it('should handle HTTP 404', () => {
    doctorServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 404 }),
      ),
    );

    fixture.detectChanges();

    expect(component.doctor()).toBeNull();
    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'The requested doctor could not be found.',
    );
  });

  it('should handle HTTP 401', () => {
    doctorServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 401 }),
      ),
    );

    fixture.detectChanges();

    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'Your session has expired.',
    );
  });

  it('should handle HTTP 403', () => {
    doctorServiceMock.getById.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403 }),
      ),
    );

    fixture.detectChanges();

    expect(component.canRetry()).toBe(false);

    expect(fixture.nativeElement.textContent).toContain(
      'You do not have permission to view this doctor.',
    );
  });

  it('should retry after a server error', () => {
    doctorServiceMock.getById
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 500 }),
        ),
      )
      .mockReturnValueOnce(of(doctor));

    fixture.detectChanges();

    expect(component.canRetry()).toBe(true);

    const retryButton = fixture.nativeElement.querySelector(
      'app-error-message button',
    ) as HTMLButtonElement;

    retryButton.click();
    fixture.detectChanges();

    expect(doctorServiceMock.getById).toHaveBeenCalledTimes(2);
    expect(component.doctor()).toEqual(doctor);
    expect(component.errorMessage()).toBeNull();
  });

  it('should provide navigation back to doctors', () => {
    doctorServiceMock.getById.mockReturnValue(of(doctor));

    fixture.detectChanges();

    const backLink = fixture.nativeElement.querySelector(
      '.back-link',
    ) as HTMLAnchorElement;

    expect(backLink.getAttribute('href')).toBe('/doctors');
  });
});
