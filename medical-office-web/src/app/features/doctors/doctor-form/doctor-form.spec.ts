
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Doctor } from '../doctor.model';
import { DoctorService } from '../doctor.service';
import { DoctorForm } from './doctor-form';

describe('DoctorForm', () => {
  let fixture: ComponentFixture<DoctorForm>;
  let component: DoctorForm;
  let router: Router;

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
    create: vi.fn(),
    update: vi.fn(),
  };

  const routeMock = {
    snapshot: {
      paramMap: convertToParamMap({}),
    },
  };

  beforeEach(async () => {
    Object.values(doctorServiceMock).forEach((mock) => mock.mockReset());
    routeMock.snapshot.paramMap = convertToParamMap({});

    await TestBed.configureTestingModule({
      imports: [DoctorForm],
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

    fixture = TestBed.createComponent(DoctorForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should start with an invalid empty form', () => {
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(false);
    expect(component.form.invalid).toBe(true);

    component.onSubmit();

    expect(component.firstName.touched).toBe(true);
    expect(component.lastName.touched).toBe(true);
    expect(component.specialty.touched).toBe(true);
    expect(doctorServiceMock.create).not.toHaveBeenCalled();
  });

  it('should require non-whitespace names and specialty', () => {
    fixture.detectChanges();

    component.form.patchValue({
      firstName: '   ',
      lastName: '   ',
      specialty: '   ',
    });

    expect(component.firstName.invalid).toBe(true);
    expect(component.lastName.invalid).toBe(true);
    expect(component.specialty.invalid).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    fixture.detectChanges();

    component.form.patchValue({
      firstName: 'Jane',
      lastName: 'Smith',
      specialty: 'Cardiology',
      email: 'not-an-email',
    });

    expect(component.email.invalid).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('should create a doctor with trimmed values', () => {
    doctorServiceMock.create.mockReturnValue(of(doctor));

    fixture.detectChanges();

    component.form.setValue({
      firstName: ' Jane ',
      lastName: ' Smith ',
      specialty: ' Cardiology ',
      email: 'jane@example.com',
      phone: ' 2101234567 ',
    });

    component.onSubmit();

    expect(doctorServiceMock.create).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Smith',
      specialty: 'Cardiology',
      email: 'jane@example.com',
      phone: '2101234567',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/doctors']);
  });

  it('should load an existing doctor in edit mode', () => {
    routeMock.snapshot.paramMap = convertToParamMap({
      id: doctor.id,
    });
    doctorServiceMock.getById.mockReturnValue(of(doctor));

    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.isDoctorLoaded()).toBe(true);
    expect(doctorServiceMock.getById).toHaveBeenCalledWith(
      doctor.id,
    );

    expect(component.form.getRawValue()).toEqual({
      firstName: 'Jane',
      lastName: 'Smith',
      specialty: 'Cardiology',
      email: 'jane@example.com',
      phone: '2101234567',
    });
  });

  it('should update an existing doctor', () => {
    routeMock.snapshot.paramMap = convertToParamMap({
      id: doctor.id,
    });

    doctorServiceMock.getById.mockReturnValue(of(doctor));
    doctorServiceMock.update.mockReturnValue(of(void 0));

    fixture.detectChanges();

    component.specialty.setValue('Neurology');
    component.onSubmit();

    expect(doctorServiceMock.update).toHaveBeenCalledWith(
      doctor.id,
      {
        firstName: 'Jane',
        lastName: 'Smith',
        specialty: 'Neurology',
        email: 'jane@example.com',
        phone: '2101234567',
      },
    );

    expect(router.navigate).toHaveBeenCalledWith(['/doctors']);
  });

  
    it('should navigate back without saving when cancelled', () => {
        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'Jane',
            lastName: 'Smith',
            specialty: 'Cardiology',
        });

        component.cancel();

        expect(router.navigate).toHaveBeenCalledWith(['/doctors']);
        expect(doctorServiceMock.create).not.toHaveBeenCalled();
        expect(doctorServiceMock.update).not.toHaveBeenCalled();
    });

    
    it('should display server-side validation errors', () => {
        doctorServiceMock.create.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: {
                            errors: {
                                Specialty: ['Specialty is required.'],
                            },
                        },
                    }),
            ),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'Jane',
            lastName: 'Smith',
            specialty: 'Cardiology',
        });

        component.onSubmit();
        fixture.detectChanges();

        expect(component.errorMessage()).toContain(
            'Please correct the validation errors',
        );

        expect(component.validationErrors()).toContain(
            'Specialty is required.',
        );

        expect(fixture.nativeElement.textContent).toContain(
            'Specialty is required.',
        );

        expect(router.navigate).not.toHaveBeenCalled();
    });


    it('should handle forbidden save requests', () => {
        doctorServiceMock.create.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 403 }),
            ),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'Jane',
            lastName: 'Smith',
            specialty: 'Cardiology',
        });

        component.onSubmit();
        fixture.detectChanges();

        expect(component.errorMessage()).toBe(
            'You do not have permission to save doctors.',
        );

        expect(component.isSubmitting()).toBe(false);
        expect(router.navigate).not.toHaveBeenCalled();
    });

    
    it('should prevent editing when doctor loading fails', () => {
        routeMock.snapshot.paramMap = convertToParamMap({
            id: doctor.id,
        });

        doctorServiceMock.getById.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 404 }),
            ),
        );

        fixture.detectChanges();

        expect(component.isEditMode()).toBe(true);
        expect(component.isDoctorLoaded()).toBe(false);

        expect(component.errorMessage()).toContain(
            'The requested doctor could not be found.',
        );

        component.onSubmit();

        expect(doctorServiceMock.update).not.toHaveBeenCalled();

        const form = fixture.nativeElement.querySelector('form');
        expect(form).toBeNull();
    });

    
    it('should prevent duplicate submissions while saving', () => {
        const response = new Subject<Doctor>();

        doctorServiceMock.create.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'Jane',
            lastName: 'Smith',
            specialty: 'Cardiology',
        });

        component.onSubmit();
        component.onSubmit();

        expect(doctorServiceMock.create).toHaveBeenCalledOnce();
        expect(component.isSubmitting()).toBe(true);

        fixture.detectChanges();

        const submitButton = fixture.nativeElement.querySelector(
            '.submit-button',
        ) as HTMLButtonElement;

        expect(submitButton.disabled).toBe(true);
        expect(submitButton.textContent).toContain('Saving...');

        response.next(doctor);
        response.complete();

        expect(component.isSubmitting()).toBe(false);
        expect(router.navigate).toHaveBeenCalledWith(['/doctors']);
    });

    
    it('should allow cancellation when the form is invalid', () => {
        fixture.detectChanges();

        expect(component.form.invalid).toBe(true);

        const cancelButton = fixture.nativeElement.querySelector(
            '.cancel-button',
        ) as HTMLButtonElement;

        expect(cancelButton.disabled).toBe(false);

        cancelButton.click();

        expect(router.navigate).toHaveBeenCalledWith(['/doctors']);
    });


});
