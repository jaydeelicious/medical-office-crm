
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Patient } from './patient.model';
import { PatientService } from './patient.service';
import { Patients } from './patients';

describe('Patients', () => {
    let fixture: ComponentFixture<Patients>;
    let component: Patients;

    const patient: Patient = {
        id: '8d98f074-b491-4e62-8519-d1f197c1a12e',
        firstName: 'John',
        lastName: 'Doe',
        phone: null,
        email: 'john@example.com',
        dateOfBirth: '1990-05-21',
    };

    const additionalPatients: Patient[] = [
        {
            id: 'c1234567-b491-4e62-8519-d1f197c1a12e',
            firstName: 'Maria',
            lastName: 'Papadopoulou',
            phone: '6974561230',
            email: 'maria@example.com',
            dateOfBirth: '1985-03-15',
        },
        {
            id: 'd1234567-b491-4e62-8519-d1f197c1a12e',
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '6982345678',
            email: 'jane@example.com',
            dateOfBirth: null,
        },
    ];

    const allPatients: Patient[] = [
        patient,
        ...additionalPatients,
    ];

    const patientServiceMock = {
        getAll: vi.fn(),
        delete: vi.fn(),
    };

    beforeEach(async () => {
        patientServiceMock.getAll.mockReset();
        patientServiceMock.delete.mockReset();

        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };

        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };

        await TestBed.configureTestingModule({
            imports: [Patients],
            providers: [
                provideRouter([]),
                {
                    provide: PatientService,
                    useValue: patientServiceMock,
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Patients);
        component = fixture.componentInstance;
    });

    function searchPatients(query: string): void {
        const searchInput = fixture.nativeElement.querySelector(
            '#patientSearch',
        ) as HTMLInputElement;

        if (!searchInput) {
            throw new Error('Patient search input was not found.');
        }

        searchInput.value = query;
        searchInput.dispatchEvent(
            new Event('input', { bubbles: true }),
        );

        fixture.detectChanges();
    }

    it('should load and display patients', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        fixture.detectChanges();

        expect(patientServiceMock.getAll).toHaveBeenCalledOnce();
        expect(component.patients()).toEqual([patient]);
        expect(component.isLoading()).toBe(false);

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('John');
        expect(text).toContain('Doe');
        expect(text).toContain('john@example.com');
    });

    it('should display a loading indicator while fetching patients', () => {
        const response = new Subject<Patient[]>();

        patientServiceMock.getAll.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        expect(component.isLoading()).toBe(true);

        const loading = fixture.nativeElement.querySelector(
            'app-loading-indicator',
        );

        expect(loading).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain(
            'Loading patients...',
        );

        response.complete();
    });

    it('should display an empty state when no patients exist', () => {
        patientServiceMock.getAll.mockReturnValue(of([]));

        fixture.detectChanges();

        const emptyState = fixture.nativeElement.querySelector(
            'app-empty-state',
        );

        expect(emptyState).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain(
            'No patients found',
        );
    });

    it('should display an error message when loading fails', () => {
        patientServiceMock.getAll.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 500,
                        statusText: 'Internal Server Error',
                    }),
            ),
        );

        fixture.detectChanges();

        const errorMessage = fixture.nativeElement.querySelector(
            'app-error-message',
        );

        expect(errorMessage).not.toBeNull();
        expect(fixture.nativeElement.textContent).toContain(
            'Unable to load patients',
        );
        expect(component.canRetry()).toBe(true);
    });

    it('should retry loading patients when Retry is clicked', () => {
        patientServiceMock.getAll
            .mockReturnValueOnce(
                throwError(
                    () =>
                        new HttpErrorResponse({
                            status: 500,
                            statusText: 'Internal Server Error',
                        }),
                ),
            )
            .mockReturnValueOnce(of([patient]));

        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            'app-error-message button',
        ) as HTMLButtonElement;

        retryButton.click();
        fixture.detectChanges();

        expect(patientServiceMock.getAll).toHaveBeenCalledTimes(2);
        expect(component.patients()).toEqual([patient]);
        expect(component.errorMessage()).toBeNull();
    });

    it('should link to the patient details page', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        fixture.detectChanges();

        const link = fixture.nativeElement.querySelector(
            '.details-link',
        ) as HTMLAnchorElement;

        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe(
            `/patients/${patient.id}`,
        );
    });

    it('should display an appropriate message for HTTP 403', () => {
        patientServiceMock.getAll.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 403,
                        statusText: 'Forbidden',
                    }),
            ),
        );

        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain(
            'You do not have permission to view patients.',
        );

        expect(component.canRetry()).toBe(false);

        expect(
            fixture.nativeElement.querySelector(
                'app-error-message button',
            ),
        ).toBeNull();
    });

    it('should display an appropriate message for HTTP 401', () => {
        patientServiceMock.getAll.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 401,
                        statusText: 'Unauthorized',
                    }),
            ),
        );

        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain(
            'Your session has expired.',
        );
    });


    it('should link to the create patient form', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        fixture.detectChanges();

        const newPatientLink = fixture.nativeElement.querySelector(
            '.primary-button',
        ) as HTMLAnchorElement;

        expect(newPatientLink).not.toBeNull();
        expect(newPatientLink.textContent).toContain('New patient');
        expect(newPatientLink.getAttribute('href')).toBe('/patients/new');
    });

    
    it('should open confirmation before deleting a patient', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        fixture.detectChanges();

        const deleteButton = fixture.nativeElement.querySelector(
            '.delete-button',
        ) as HTMLButtonElement;

        deleteButton.click();
        fixture.detectChanges();

        expect(component.patientToDelete()).toEqual(patient);
        expect(patientServiceMock.delete).not.toHaveBeenCalled();

        const dialog = fixture.nativeElement.querySelector(
            'app-confirm-dialog dialog',
        ) as HTMLDialogElement;

        expect(dialog).not.toBeNull();
        expect(dialog.open).toBe(true);
        expect(dialog.textContent).toContain('John Doe');
    });

    
    it('should cancel deletion without calling the API', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        fixture.detectChanges();

        component.requestDelete(patient);
        fixture.detectChanges();

        const cancelButton = fixture.nativeElement.querySelector(
            'app-confirm-dialog .cancel-button',
        ) as HTMLButtonElement;

        cancelButton.click();
        fixture.detectChanges();

        expect(component.patientToDelete()).toBeNull();
        expect(component.patients()).toEqual([patient]);
        expect(patientServiceMock.delete).not.toHaveBeenCalled();
    });


    
    it('should remove the patient after successful deletion', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));
        patientServiceMock.delete.mockReturnValue(of(void 0));

        fixture.detectChanges();

        component.requestDelete(patient);
        component.confirmDelete();
        fixture.detectChanges();

        expect(patientServiceMock.delete).toHaveBeenCalledOnce();
        expect(patientServiceMock.delete).toHaveBeenCalledWith(
            patient.id,
        );

        expect(component.patients()).toEqual([]);
        expect(component.patientToDelete()).toBeNull();
        expect(component.isDeleting()).toBe(false);

        const emptyState = fixture.nativeElement.querySelector(
            'app-empty-state',
        );

        expect(emptyState).not.toBeNull();
    });

    
    it('should preserve the patient when deletion fails', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        patientServiceMock.delete.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 500,
                        statusText: 'Internal Server Error',
                    }),
            ),
        );

        fixture.detectChanges();

        component.requestDelete(patient);
        component.confirmDelete();
        fixture.detectChanges();

        expect(component.patients()).toEqual([patient]);
        expect(component.patientToDelete()).toBeNull();
        expect(component.isDeleting()).toBe(false);

        expect(component.deleteError()).toContain(
            'Unable to delete the patient',
        );

        const errorMessage = fixture.nativeElement.querySelector(
            'app-error-message',
        );

        expect(errorMessage).not.toBeNull();
    });

    
    it('should prevent duplicate deletion requests', () => {
        const response = new Subject<void>();

        patientServiceMock.getAll.mockReturnValue(of([patient]));
        patientServiceMock.delete.mockReturnValue(
            response.asObservable(),
        );

        fixture.detectChanges();

        component.requestDelete(patient);

        component.confirmDelete();
        component.confirmDelete();

        expect(patientServiceMock.delete).toHaveBeenCalledOnce();
        expect(component.isDeleting()).toBe(true);

        response.next();
        response.complete();

        expect(component.isDeleting()).toBe(false);
        expect(component.patients()).toEqual([]);
    });


    
    it('should handle deletion conflicts', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        patientServiceMock.delete.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 409 }),
            ),
        );

        fixture.detectChanges();

        component.requestDelete(patient);
        component.confirmDelete();

        expect(component.patients()).toEqual([patient]);
        expect(component.deleteError()).toContain(
            'existing related records',
        );
    });

    
    it('should handle forbidden deletion requests', () => {
        patientServiceMock.getAll.mockReturnValue(of([patient]));

        patientServiceMock.delete.mockReturnValue(
            throwError(
                () => new HttpErrorResponse({ status: 403 }),
            ),
        );

        fixture.detectChanges();

        component.requestDelete(patient);
        component.confirmDelete();

        expect(component.patients()).toEqual([patient]);
        expect(component.deleteError()).toContain(
            'You do not have permission to delete patients.',
        );
    });

    describe('Patient search', () => {
        beforeEach(() => {
            patientServiceMock.getAll.mockReturnValue(of(allPatients));
            fixture.detectChanges();
        });

        it('should show all patients when search is empty', () => {
            expect(component.searchQuery()).toBe('');
            expect(component.filteredPatients()).toEqual(allPatients);
        });

        it('should search by first name', () => {
            searchPatients('Maria');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should search by last name', () => {
            searchPatients('Smith');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[1],
            ]);
        });

        it('should search by full name', () => {
            searchPatients('Maria Papadopoulou');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should search by reversed full name', () => {
            searchPatients('Papadopoulou Maria');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should search case-insensitively', () => {
            searchPatients('MARIA');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should ignore surrounding whitespace', () => {
            searchPatients('   Maria   ');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should search by email', () => {
            searchPatients('jane@example.com');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[1],
            ]);
        });

        it('should search by partial email', () => {
            searchPatients('maria@');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should search by phone number', () => {
            searchPatients('697456');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);
        });

        it('should handle patients with null email and phone', () => {
            searchPatients('John');

            expect(component.filteredPatients()).toEqual([patient]);
        });

        it('should display only matching patients in the table', () => {
            searchPatients('Maria');

            const rows = fixture.nativeElement.querySelectorAll(
                'tbody tr',
            ) as NodeListOf<HTMLTableRowElement>;

            expect(rows.length).toBe(1);
            expect(rows[0].textContent).toContain('Maria');
            expect(rows[0].textContent).toContain('Papadopoulou');
            expect(rows[0].textContent).not.toContain('Jane');
        });

        it('should display a dedicated empty state when no matches exist', () => {
            searchPatients('Nonexistent Patient');

            expect(component.filteredPatients()).toEqual([]);

            expect(fixture.nativeElement.textContent).toContain(
                'No matching patients',
            );

            expect(fixture.nativeElement.textContent).toContain(
                'Try another name, email or phone number.',
            );
        });

        it('should restore all patients after clearing search', () => {
            searchPatients('Maria');

            expect(component.filteredPatients().length).toBe(1);

            const clearButton = fixture.nativeElement.querySelector(
                '.clear-search-button',
            ) as HTMLButtonElement;

            expect(clearButton).not.toBeNull();

            clearButton.click();
            fixture.detectChanges();

            expect(component.searchQuery()).toBe('');
            expect(component.filteredPatients()).toEqual(allPatients);

            const searchInput = fixture.nativeElement.querySelector(
                '#patientSearch',
            ) as HTMLInputElement;

            expect(searchInput.value).toBe('');
        });

        it('should treat whitespace-only search as empty', () => {
            searchPatients('    ');

            expect(component.filteredPatients()).toEqual(allPatients);
        });

        it('should not make additional API calls while searching', () => {
            searchPatients('M');
            searchPatients('Ma');
            searchPatients('Maria');

            expect(patientServiceMock.getAll).toHaveBeenCalledOnce();
        });

        it('should update search results after deleting a matching patient', () => {
            patientServiceMock.delete.mockReturnValue(of(void 0));

            searchPatients('Maria');

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);

            component.requestDelete(additionalPatients[0]);
            component.confirmDelete();
            fixture.detectChanges();

            expect(patientServiceMock.delete).toHaveBeenCalledWith(
                additionalPatients[0].id,
            );

            expect(component.filteredPatients()).toEqual([]);

            expect(fixture.nativeElement.textContent).toContain(
                'No matching patients',
            );

            expect(component.patients().length).toBe(2);
        });

        it('should retain search results when deletion fails', () => {
            patientServiceMock.delete.mockReturnValue(
                throwError(
                    () => new HttpErrorResponse({ status: 500 }),
                ),
            );

            searchPatients('Maria');

            component.requestDelete(additionalPatients[0]);
            component.confirmDelete();
            fixture.detectChanges();

            expect(component.filteredPatients()).toEqual([
                additionalPatients[0],
            ]);

            expect(component.searchQuery()).toBe('Maria');
        });
    });
});
