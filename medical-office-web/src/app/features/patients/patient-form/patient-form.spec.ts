
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

    function enterDob(
        day: string,
        month: string,
        year: string,
    ): void {
        const values: Record<string, string> = {
            day,
            month,
            year,
        };

        for (const [part, value] of Object.entries(values)) {
            const input = fixture.nativeElement.querySelector(
                `#dob-${part}`,
            ) as HTMLInputElement | null;

            if (!input) {
                throw new Error(`DOB input '${part}' was not found.`);
            }

            input.value = value;
            input.dispatchEvent(
                new Event('input', { bubbles: true }),
            );
        }

        fixture.detectChanges();
    }

    function fillRequiredFields(): void {
        component.form.patchValue({
            firstName: 'John',
            lastName: 'Doe',
        });

        fixture.detectChanges();
    }


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

    describe('Date of birth integration', () => {
        it('should allow an empty DOB and submit null', () => {
            patientServiceMock.create.mockReturnValue(of(patient));

            fixture.detectChanges();
            fillRequiredFields();

            expect(component.dateOfBirth.valid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateOfBirth: null,
                }),
            );
        });

        it('should submit a manually entered DOB as yyyy-MM-dd', () => {
            patientServiceMock.create.mockReturnValue(of(patient));

            fixture.detectChanges();
            fillRequiredFields();

            enterDob('21', '05', '1990');

            expect(component.dateOfBirth.valid).toBe(true);
            expect(component.dateOfBirth.value).toBe('1990-05-21');

            component.onSubmit();

            expect(patientServiceMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateOfBirth: '1990-05-21',
                }),
            );
        });

        it('should submit an unpadded DOB in ISO format', () => {
            patientServiceMock.create.mockReturnValue(of(patient));

            fixture.detectChanges();
            fillRequiredFields();

            enterDob('3', '5', '1990');

            expect(component.dateOfBirth.valid).toBe(true);
            expect(component.dateOfBirth.value).toBe('1990-05-03');

            component.onSubmit();

            expect(patientServiceMock.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    dateOfBirth: '1990-05-03',
                }),
            );
        });

        it('should reject an incomplete DOB and prevent submission', () => {
            fixture.detectChanges();
            fillRequiredFields();

            enterDob('', '', '1990');

            expect(component.dateOfBirth.invalid).toBe(true);
            expect(component.dateOfBirth.hasError('incompleteDate')).toBe(true);
            expect(component.form.invalid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.create).not.toHaveBeenCalled();
        });

        it('should reject an impossible DOB and prevent submission', () => {
            fixture.detectChanges();
            fillRequiredFields();

            enterDob('31', '02', '1990');

            expect(component.dateOfBirth.invalid).toBe(true);
            expect(component.dateOfBirth.hasError('invalidDate')).toBe(true);
            expect(component.form.invalid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.create).not.toHaveBeenCalled();
        });

        it('should reject a future DOB and prevent submission', () => {
            fixture.detectChanges();
            fillRequiredFields();

            const futureYear = String(new Date().getFullYear() + 1);

            enterDob('01', '01', futureYear);

            expect(component.dateOfBirth.invalid).toBe(true);
            expect(component.dateOfBirth.hasError('futureDate')).toBe(true);
            expect(component.form.invalid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.create).not.toHaveBeenCalled();
        });

        it('should become valid after correcting an invalid DOB', () => {
            fixture.detectChanges();
            fillRequiredFields();

            enterDob('31', '02', '1990');

            expect(component.dateOfBirth.invalid).toBe(true);

            enterDob('28', '02', '1990');

            expect(component.dateOfBirth.valid).toBe(true);
            expect(component.dateOfBirth.value).toBe('1990-02-28');
            expect(component.form.valid).toBe(true);
        });

        it('should become valid after clearing an incomplete DOB', () => {
            fixture.detectChanges();
            fillRequiredFields();

            enterDob('', '', '1990');

            expect(component.dateOfBirth.invalid).toBe(true);

            enterDob('', '', '');

            expect(component.dateOfBirth.valid).toBe(true);
            expect(component.dateOfBirth.value).toBe('');
            expect(component.form.valid).toBe(true);
        });

        it('should populate DOB inputs when editing a patient', () => {
            routeMock.snapshot.paramMap = convertToParamMap({
                id: patient.id,
            });

            patientServiceMock.getById.mockReturnValue(of(patient));

            fixture.detectChanges();

            const dayInput = fixture.nativeElement.querySelector(
                '#dob-day',
            ) as HTMLInputElement;

            const monthInput = fixture.nativeElement.querySelector(
                '#dob-month',
            ) as HTMLInputElement;

            const yearInput = fixture.nativeElement.querySelector(
                '#dob-year',
            ) as HTMLInputElement;

            expect(dayInput.value).toBe('21');
            expect(monthInput.value).toBe('05');
            expect(yearInput.value).toBe('1990');

            expect(component.dateOfBirth.value).toBe('1990-05-21');
        });

        it('should update a patient with a changed DOB', () => {
            routeMock.snapshot.paramMap = convertToParamMap({
                id: patient.id,
            });

            patientServiceMock.getById.mockReturnValue(of(patient));
            patientServiceMock.update.mockReturnValue(of(void 0));

            fixture.detectChanges();

            enterDob('15', '08', '1985');

            expect(component.dateOfBirth.valid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.update).toHaveBeenCalledWith(
                patient.id,
                expect.objectContaining({
                    dateOfBirth: '1985-08-15',
                }),
            );
        });

        it('should not update a patient with an invalid DOB', () => {
            routeMock.snapshot.paramMap = convertToParamMap({
                id: patient.id,
            });

            patientServiceMock.getById.mockReturnValue(of(patient));

            fixture.detectChanges();

            enterDob('31', '04', '1990');

            expect(component.form.invalid).toBe(true);

            component.onSubmit();

            expect(patientServiceMock.update).not.toHaveBeenCalled();
        });
    });

});
