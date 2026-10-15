
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Doctor } from './doctor.model';
import { DoctorService } from './doctor.service';
import { Doctors } from './doctors';

describe('Doctors', () => {
  let fixture: ComponentFixture<Doctors>;
  let component: Doctors;

  const doctor: Doctor = {
    id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
    firstName: 'Jane',
    lastName: 'Smith',
    specialty: 'Cardiology',
    email: 'jane@example.com',
    phone: '2101234567',
  };

  const doctorServiceMock = {
    getAll: vi.fn(),
  };

  beforeEach(async () => {
    doctorServiceMock.getAll.mockReset();

    await TestBed.configureTestingModule({
      imports: [Doctors],
      providers: [
        provideRouter([]),
        {
          provide: DoctorService,
          useValue: doctorServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Doctors);
    component = fixture.componentInstance;
  });

  it('should load and display doctors', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    fixture.detectChanges();

    expect(doctorServiceMock.getAll).toHaveBeenCalledOnce();
    expect(component.doctors()).toEqual([doctor]);
    expect(component.isLoading()).toBe(false);

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Jane');
    expect(text).toContain('Smith');
    expect(text).toContain('Cardiology');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('2101234567');
  });

  it('should display a loading indicator while fetching doctors', () => {
    const response = new Subject<Doctor[]>();

    doctorServiceMock.getAll.mockReturnValue(
      response.asObservable(),
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(true);

    const loading = fixture.nativeElement.querySelector(
      'app-loading-indicator',
    );

    expect(loading).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Loading doctors...',
    );

    response.complete();
  });

  it('should display an empty state when no doctors exist', () => {
    doctorServiceMock.getAll.mockReturnValue(of([]));

    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector(
      'app-empty-state',
    );

    expect(emptyState).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'No doctors found',
    );
  });

  it('should display an error when loading fails', () => {
    doctorServiceMock.getAll.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 500 }),
      ),
    );

    fixture.detectChanges();

    expect(component.doctors()).toEqual([]);
    expect(component.canRetry()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load doctors.',
    );
  });

  it('should retry after a server error', () => {
    doctorServiceMock.getAll
      .mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 500 }),
        ),
      )
      .mockReturnValueOnce(of([doctor]));

    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector(
      'app-error-message button',
    ) as HTMLButtonElement;

    retryButton.click();
    fixture.detectChanges();

    expect(doctorServiceMock.getAll).toHaveBeenCalledTimes(2);
    expect(component.doctors()).toEqual([doctor]);
    expect(component.errorMessage()).toBeNull();
  });

  it('should display an authorization error without retry', () => {
    doctorServiceMock.getAll.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403 }),
      ),
    );

    fixture.detectChanges();

    expect(component.canRetry()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'You do not have permission to view doctors.',
    );
  });

  it('should link to the doctor details page', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.details-link',
    ) as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(
      `/doctors/${doctor.id}`,
    );
  });

  it('should link to the create doctor form', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.primary-button',
    ) as HTMLAnchorElement;

    expect(link.textContent).toContain('New doctor');
    expect(link.getAttribute('href')).toBe('/doctors/new');
  });
});
