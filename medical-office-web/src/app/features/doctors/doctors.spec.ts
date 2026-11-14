
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

  const additionalDoctors: Doctor[] = [
      {
          id: 'c1234567-b491-4e62-8519-d1f197c1a12e',
          firstName: 'Maria',
          lastName: 'Papadopoulou',
          specialty: 'Dermatology',
          email: 'maria@example.com',
          phone: '6974561230',
      },
      {
          id: 'd1234567-b491-4e62-8519-d1f197c1a12e',
          firstName: 'George',
          lastName: 'Nikolaou',
          specialty: 'Neurology',
          email: null,
          phone: null,
      },
      {
          id: 'e1234567-b491-4e62-8519-d1f197c1a12e',
          firstName: 'Anna',
          lastName: 'Brown',
          specialty: 'Cardiology',
          email: 'anna@example.com',
          phone: '6982345678',
      },
  ];

  const allDoctors: Doctor[] = [
      doctor,
      ...additionalDoctors,
  ];

  const doctorServiceMock = {
    getAll: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    doctorServiceMock.getAll.mockReset();
    doctorServiceMock.delete.mockReset();

    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };

    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };

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

  function searchDoctors(query: string): void {
      const searchInput = fixture.nativeElement.querySelector(
          '#doctorSearch',
      ) as HTMLInputElement | null;

      if (!searchInput) {
          throw new Error('Doctor search input was not found.');
      }

      searchInput.value = query;
      searchInput.dispatchEvent(
          new Event('input', { bubbles: true }),
      );

      fixture.detectChanges();
  }

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
  
  it('should open confirmation before deleting a doctor', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector(
      '.delete-button',
    ) as HTMLButtonElement;

    deleteButton.click();
    fixture.detectChanges();

    expect(component.doctorToDelete()).toEqual(doctor);
    expect(doctorServiceMock.delete).not.toHaveBeenCalled();

    const dialog = fixture.nativeElement.querySelector(
      'app-confirm-dialog dialog',
    ) as HTMLDialogElement;

    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Jane Smith');
  });

  it('should cancel deletion without calling the API', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    fixture.detectChanges();

    component.requestDelete(doctor);
    fixture.detectChanges();

    const cancelButton = fixture.nativeElement.querySelector(
      'app-confirm-dialog .cancel-button',
    ) as HTMLButtonElement;

    cancelButton.click();
    fixture.detectChanges();

    expect(component.doctorToDelete()).toBeNull();
    expect(component.doctors()).toEqual([doctor]);
    expect(doctorServiceMock.delete).not.toHaveBeenCalled();
  });

  it('should remove the doctor after successful deletion', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));
    doctorServiceMock.delete.mockReturnValue(of(void 0));

    fixture.detectChanges();

    component.requestDelete(doctor);
    component.confirmDelete();
    fixture.detectChanges();

    expect(doctorServiceMock.delete).toHaveBeenCalledOnce();
    expect(doctorServiceMock.delete).toHaveBeenCalledWith(
      doctor.id,
    );

    expect(component.doctors()).toEqual([]);
    expect(component.doctorToDelete()).toBeNull();
    expect(component.isDeleting()).toBe(false);

    const emptyState = fixture.nativeElement.querySelector(
      'app-empty-state',
    );

    expect(emptyState).not.toBeNull();
  });

  it('should preserve the doctor when deletion fails', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    doctorServiceMock.delete.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Internal Server Error',
          }),
      ),
    );

    fixture.detectChanges();

    component.requestDelete(doctor);
    component.confirmDelete();
    fixture.detectChanges();

    expect(component.doctors()).toEqual([doctor]);
    expect(component.doctorToDelete()).toBeNull();
    expect(component.isDeleting()).toBe(false);

    expect(component.deleteError()).toContain(
      'Unable to delete the doctor',
    );

    const errorMessage = fixture.nativeElement.querySelector(
      'app-error-message',
    );

    expect(errorMessage).not.toBeNull();
  });

  it('should prevent duplicate deletion requests', () => {
    const response = new Subject<void>();

    doctorServiceMock.getAll.mockReturnValue(of([doctor]));
    doctorServiceMock.delete.mockReturnValue(
      response.asObservable(),
    );

    fixture.detectChanges();

    component.requestDelete(doctor);

    component.confirmDelete();
    component.confirmDelete();

    expect(doctorServiceMock.delete).toHaveBeenCalledOnce();
    expect(component.isDeleting()).toBe(true);

    response.next();
    response.complete();

    expect(component.isDeleting()).toBe(false);
    expect(component.doctors()).toEqual([]);
  });

  it('should handle deletion conflicts', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    doctorServiceMock.delete.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409 }),
      ),
    );

    fixture.detectChanges();

    component.requestDelete(doctor);
    component.confirmDelete();

    expect(component.doctors()).toEqual([doctor]);
    expect(component.deleteError()).toContain(
      'existing related records',
    );
  });
  
  it('should handle deletion conflicts', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    doctorServiceMock.delete.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409 }),
      ),
    );

    fixture.detectChanges();

    component.requestDelete(doctor);
    component.confirmDelete();

    expect(component.doctors()).toEqual([doctor]);
    expect(component.deleteError()).toContain(
      'existing related records',
    );
  });

  it('should handle forbidden deletion requests', () => {
    doctorServiceMock.getAll.mockReturnValue(of([doctor]));

    doctorServiceMock.delete.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 403 }),
      ),
    );

    fixture.detectChanges();

    component.requestDelete(doctor);
    component.confirmDelete();

    expect(component.doctors()).toEqual([doctor]);
    expect(component.deleteError()).toContain(
      'You do not have permission to delete doctors.',
    );
  });

  describe('Doctor search', () => {
      beforeEach(() => {
          doctorServiceMock.getAll.mockReturnValue(of(allDoctors));
          fixture.detectChanges();
      });

      it('should initially display all doctors', () => {
          expect(component.searchQuery()).toBe('');
          expect(component.filteredDoctors()).toEqual(allDoctors);

          const rows = fixture.nativeElement.querySelectorAll('tbody tr');
          expect(rows.length).toBe(4);
      });

      it('should search by first name', () => {
          searchDoctors('Maria');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should search by last name', () => {
          searchDoctors('Nikolaou');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[1],
          ]);
      });

      it('should search by full name', () => {
          searchDoctors('Maria Papadopoulou');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should search by reversed full name', () => {
          searchDoctors('Papadopoulou Maria');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should search case-insensitively', () => {
          searchDoctors('MARIA');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should ignore surrounding whitespace', () => {
          searchDoctors('   Maria   ');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should search by specialty', () => {
          searchDoctors('Dermatology');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should return multiple doctors with the same specialty', () => {
          searchDoctors('Cardiology');

          expect(component.filteredDoctors()).toEqual([
              doctor,
              additionalDoctors[2],
          ]);
      });

      it('should search specialty case-insensitively', () => {
          searchDoctors('NEUROLOGY');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[1],
          ]);
      });

      it('should search by partial email', () => {
          searchDoctors('maria@');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should search by phone number', () => {
          searchDoctors('697456');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);
      });

      it('should handle doctors with null email and phone', () => {
          searchDoctors('George');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[1],
          ]);
      });

      it('should display only matching doctors in the table', () => {
          searchDoctors('Dermatology');

          const rows = fixture.nativeElement.querySelectorAll(
              'tbody tr',
          ) as NodeListOf<HTMLTableRowElement>;

          expect(rows.length).toBe(1);
          expect(rows[0].textContent).toContain('Maria');
          expect(rows[0].textContent).toContain('Dermatology');
          expect(rows[0].textContent).not.toContain('Jane');
      });

      it('should show a dedicated empty state for no matches', () => {
          searchDoctors('Nonexistent Specialty');

          expect(component.filteredDoctors()).toEqual([]);

          expect(fixture.nativeElement.textContent).toContain(
              'No matching doctors',
          );

          expect(fixture.nativeElement.textContent).toContain(
              'Try another name, specialty, email or phone number.',
          );
      });

      it('should restore all doctors after clearing search', () => {
          searchDoctors('Maria');

          expect(component.filteredDoctors().length).toBe(1);

          const clearButton = fixture.nativeElement.querySelector(
              '.clear-search-button',
          ) as HTMLButtonElement;

          expect(clearButton).not.toBeNull();

          clearButton.click();
          fixture.detectChanges();

          expect(component.searchQuery()).toBe('');
          expect(component.filteredDoctors()).toEqual(allDoctors);

          const searchInput = fixture.nativeElement.querySelector(
              '#doctorSearch',
          ) as HTMLInputElement;

          expect(searchInput.value).toBe('');
      });

      it('should treat whitespace-only search as empty', () => {
          searchDoctors('   ');

          expect(component.filteredDoctors()).toEqual(allDoctors);
      });

      it('should not make additional API calls while searching', () => {
          searchDoctors('M');
          searchDoctors('Ma');
          searchDoctors('Maria');

          expect(doctorServiceMock.getAll).toHaveBeenCalledOnce();
      });

      it('should update filtered results after deleting a doctor', () => {
          doctorServiceMock.delete.mockReturnValue(of(void 0));

          searchDoctors('Maria');

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);

          component.requestDelete(additionalDoctors[0]);
          component.confirmDelete();
          fixture.detectChanges();

          expect(doctorServiceMock.delete).toHaveBeenCalledWith(
              additionalDoctors[0].id,
          );

          expect(component.filteredDoctors()).toEqual([]);
          expect(component.doctors().length).toBe(3);

          expect(fixture.nativeElement.textContent).toContain(
              'No matching doctors',
          );
      });

      it('should preserve search results when deletion fails', () => {
          doctorServiceMock.delete.mockReturnValue(
              throwError(
                  () => new HttpErrorResponse({ status: 500 }),
              ),
          );

          searchDoctors('Maria');

          component.requestDelete(additionalDoctors[0]);
          component.confirmDelete();
          fixture.detectChanges();

          expect(component.filteredDoctors()).toEqual([
              additionalDoctors[0],
          ]);

          expect(component.searchQuery()).toBe('Maria');
          expect(component.doctors()).toEqual(allDoctors);
      });
  });
});
