
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    ActivatedRoute,
    convertToParamMap,
    provideRouter,
} from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Patient } from '../patient.model';
import { PatientService } from '../patient.service';
import { PatientDetails } from './patient-details';

describe('PatientDetails', () => {
    let fixture: ComponentFixture<PatientDetails>;
    let component: PatientDetails;

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
    };

    const routeMock = {
        snapshot: {
            paramMap: convertToParamMap({ id: patient.id }),
        },
    };

    beforeEach(async () => {
        patientServiceMock.getById.mockReset();
        routeMock.snapshot.paramMap = convertToParamMap({
            id: patient.id,
        });

        await TestBed.configureTestingModule({
            imports: [PatientDetails],
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

        fixture = TestBed.createComponent(PatientDetails);
        component = fixture.componentInstance;
    });

    it('should load and display patient details', () => {
        patientServiceMock.getById.mockReturnValue(of(patient));

        fixture.detectChanges();

        expect(patientServiceMock.getById).toHaveBeenCalledWith(
            patient.id,
        );
        expect(component.patient()).toEqual(patient);
        expect(component.isLoading()).toBe(false);

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('John');
        expect(text).toContain('Doe');
        expect(text).toContain('john@example.com');
        expect(text).toContain('1990-05-21');
    });

    it('should display a loading indicator while fetching details', () => {
        const response = new Subject<Patient>();

        patientServiceMock.getById.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        expect(component.isLoading()).toBe(true);

        const loading = fixture.nativeElement.querySelector(
            'app-loading-indicator',
        );

        expect(loading).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain(
            'Loading patient details...',
        );

        response.complete();
    });

    it('should handle a missing patient ID', () => {
        routeMock.snapshot.paramMap = convertToParamMap({});

        fixture.detectChanges();

        expect(patientServiceMock.getById).not.toHaveBeenCalled();
        expect(component.patient()).toBeNull();
        expect(component.canRetry()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'No patient ID was provided.',
        );
    });

    it('should display a not-found message for HTTP 404', () => {
        patientServiceMock.getById.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 404,
                        statusText: 'Not Found',
                    }),
            ),
        );

        fixture.detectChanges();

        expect(component.patient()).toBeNull();
        expect(component.canRetry()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'The requested patient could not be found.',
        );
    });

    it('should display a session-expired message for HTTP 401', () => {
        patientServiceMock.getById.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 401,
                        statusText: 'Unauthorized',
                    }),
            ),
        );

        fixture.detectChanges();

        expect(component.canRetry()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'Your session has expired.',
        );
    });

    it('should display a permission error for HTTP 403', () => {
        patientServiceMock.getById.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 403,
                        statusText: 'Forbidden',
                    }),
            ),
        );

        fixture.detectChanges();

        expect(component.canRetry()).toBe(false);

        expect(fixture.nativeElement.textContent).toContain(
            'You do not have permission to view this patient.',
        );
    });

    it('should allow retrying after a server error', () => {
        patientServiceMock.getById
            .mockReturnValueOnce(
                throwError(
                    () =>
                        new HttpErrorResponse({
                            status: 500,
                            statusText: 'Internal Server Error',
                        }),
                ),
            )
            .mockReturnValueOnce(of(patient));

        fixture.detectChanges();

        expect(component.canRetry()).toBe(true);

        const retryButton = fixture.nativeElement.querySelector(
            'app-error-message button',
        ) as HTMLButtonElement;

        expect(retryButton).not.toBeNull();

        retryButton.click();
        fixture.detectChanges();

        expect(patientServiceMock.getById).toHaveBeenCalledTimes(2);
        expect(component.patient()).toEqual(patient);
        expect(component.errorMessage()).toBeNull();
        expect(component.canRetry()).toBe(false);
    });

    it('should provide navigation back to the patient listing', () => {
        patientServiceMock.getById.mockReturnValue(of(patient));

        fixture.detectChanges();

        const backLink = fixture.nativeElement.querySelector(
            '.back-link',
        ) as HTMLAnchorElement;

        expect(backLink.getAttribute('href')).toBe('/patients');
    });


    it('should link to the edit patient form', () => {
        patientServiceMock.getById.mockReturnValue(of(patient));

        fixture.detectChanges();

        const editLink = fixture.nativeElement.querySelector(
            '.edit-button',
        ) as HTMLAnchorElement;

        expect(editLink).not.toBeNull();
        expect(editLink.textContent).toContain('Edit patient');
        expect(editLink.getAttribute('href')).toBe(
            `/patients/${patient.id}/edit`,
        );
    });

});
