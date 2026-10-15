
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

import { Patient } from '../patient.model';
import { PatientService } from '../patient.service';
import { PatientForm } from './patient-form';

describe('PatientForm', () => {
    let fixture: ComponentFixture<PatientForm>;
    let component: PatientForm;
    let router: Router;

    const patient: Patient = {
        id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
        firstName: 'John',
        lastName: 'Doe',
        phone: null,
        email: 'john@example.com',
        dateOfBirth: '1990-05-21',
    };

    const patientServiceMock = {
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
        vi.resetAllMocks();

        routeMock.snapshot.paramMap = convertToParamMap({});

        await TestBed.configureTestingModule({
            imports: [PatientForm],
            providers: [
                provideRouter([]),
                {
                    provide: PatientService,
                    useValue: patientServiceMock,
                },
                {
                    provide: ActivatedRoute,
                    useValue: routeMock,
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PatientForm);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);

        vi.spyOn(router, 'navigate').mockResolvedValue(true);
    });


    it('should start with an invalid empty form', () => {
        fixture.detectChanges();

        expect(component.isEditMode()).toBe(false);
        expect(component.form.invalid).toBe(true);
        expect(component.firstName.hasError('required')).toBe(true);
        expect(component.lastName.hasError('required')).toBe(true);
    });

    it('should reject whitespace-only names', () => {
        fixture.detectChanges();

        component.firstName.setValue('   ');
        component.lastName.setValue('   ');

        expect(component.form.invalid).toBe(true);
        expect(component.firstName.hasError('pattern')).toBe(true);
        expect(component.lastName.hasError('pattern')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
        fixture.detectChanges();

        component.firstName.setValue('John');
        component.lastName.setValue('Doe');
        component.email.setValue('invalid-email');

        expect(component.email.hasError('email')).toBe(true);
        expect(component.form.invalid).toBe(true);
    });

    it('should reject fields exceeding maximum lengths', () => {
        fixture.detectChanges();

        component.firstName.setValue('A'.repeat(101));
        component.lastName.setValue('B'.repeat(101));
        component.phone.setValue('1'.repeat(31));
        component.email.setValue('a'.repeat(201));

        expect(component.firstName.hasError('maxlength')).toBe(true);
        expect(component.lastName.hasError('maxlength')).toBe(true);
        expect(component.phone.hasError('maxlength')).toBe(true);
        expect(component.email.hasError('maxlength')).toBe(true);
    });

    it('should not submit an invalid form', () => {
        fixture.detectChanges();

        component.onSubmit();

        expect(patientServiceMock.create).not.toHaveBeenCalled();
        expect(patientServiceMock.update).not.toHaveBeenCalled();
        expect(component.firstName.touched).toBe(true);
        expect(component.lastName.touched).toBe(true);
    });


    it('should create a patient and navigate to the listing', () => {
        patientServiceMock.create.mockReturnValue(of(patient));

        fixture.detectChanges();

        component.form.patchValue({
            firstName: ' John ',
            lastName: ' Doe ',
            phone: '',
            email: 'john@example.com',
            dateOfBirth: '1990-05-21',
        });

        component.onSubmit();

        expect(patientServiceMock.create).toHaveBeenCalledWith({
            firstName: 'John',
            lastName: 'Doe',
            phone: null,
            email: 'john@example.com',
            dateOfBirth: '1990-05-21',
        });

        expect(router.navigate).toHaveBeenCalledWith(['/patients']);
    });

    it('should prevent duplicate submissions', () => {
        const response = new Subject<Patient>();
        patientServiceMock.create.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'John',
            lastName: 'Doe',
        });

        component.onSubmit();
        component.onSubmit();

        expect(patientServiceMock.create).toHaveBeenCalledOnce();
        expect(component.isSubmitting()).toBe(true);

        response.next(patient);
        response.complete();

        expect(component.isSubmitting()).toBe(false);
    });

    it('should handle server-side validation errors', () => {
        patientServiceMock.create.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: {
                            errors: {
                                FirstName: ['First name is invalid.'],
                            },
                        },
                    }),
            ),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'John',
            lastName: 'Doe',
        });

        component.onSubmit();
        fixture.detectChanges();

        expect(component.validationErrors()).toContain(
            'First name is invalid.',
        );
        expect(component.isSubmitting()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'First name is invalid.',
        );
    });



    it('should load an existing patient into the form', () => {
        routeMock.snapshot.paramMap = convertToParamMap({
            id: patient.id,
        });

        patientServiceMock.getById.mockReturnValue(of(patient));

        fixture.detectChanges();

        expect(component.isEditMode()).toBe(true);
        expect(component.isPatientLoaded()).toBe(true);

        expect(patientServiceMock.getById).toHaveBeenCalledWith(
            patient.id,
        );

        expect(component.form.getRawValue()).toEqual({
            firstName: 'John',
            lastName: 'Doe',
            phone: '',
            email: 'john@example.com',
            dateOfBirth: '1990-05-21',
        });
    });

    it('should update an existing patient', () => {
        routeMock.snapshot.paramMap = convertToParamMap({
            id: patient.id,
        });

        patientServiceMock.getById.mockReturnValue(of(patient));
        patientServiceMock.update.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.firstName.setValue('Jane');
        component.onSubmit();

        expect(patientServiceMock.update).toHaveBeenCalledWith(
            patient.id,
            {
                firstName: 'Jane',
                lastName: 'Doe',
                phone: null,
                email: 'john@example.com',
                dateOfBirth: '1990-05-21',
            },
        );

        expect(router.navigate).toHaveBeenCalledWith(['/patients']);
    });

    it('should not submit edits if loading the patient fails', () => {
        routeMock.snapshot.paramMap = convertToParamMap({
            id: patient.id,
        });

        patientServiceMock.getById.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 404 }),
            ),
        );

        fixture.detectChanges();

        component.form.patchValue({
            firstName: 'Jane',
            lastName: 'Doe',
        });

        component.onSubmit();

        expect(component.isPatientLoaded()).toBe(false);
        expect(patientServiceMock.update).not.toHaveBeenCalled();
        expect(patientServiceMock.create).not.toHaveBeenCalled();
    });

    it('should cancel without submitting', () => {
        fixture.detectChanges();

        component.cancel();

        expect(router.navigate).toHaveBeenCalledWith(['/patients']);
        expect(patientServiceMock.create).not.toHaveBeenCalled();
        expect(patientServiceMock.update).not.toHaveBeenCalled();
    });
});
