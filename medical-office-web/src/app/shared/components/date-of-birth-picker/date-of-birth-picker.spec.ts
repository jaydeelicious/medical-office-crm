
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DateOfBirthPicker } from './date-of-birth-picker';

describe('DateOfBirthPicker', () => {
    let fixture: ComponentFixture<DateOfBirthPicker>;
    let component: DateOfBirthPicker;

    let onChange: ReturnType<typeof vi.fn<(value: string) => void>>;
    let onTouched: ReturnType<typeof vi.fn<() => void>>;
    let onValidatorChange: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DateOfBirthPicker],
        }).compileComponents();

        fixture = TestBed.createComponent(DateOfBirthPicker);
        component = fixture.componentInstance;

        onChange = vi.fn<(value: string) => void>();
        onTouched = vi.fn<() => void>();
        onValidatorChange = vi.fn<() => void>();

        component.registerOnChange(onChange);
        component.registerOnTouched(onTouched);
        component.registerOnValidatorChange(onValidatorChange);

        fixture.detectChanges();
    });

    function enterDate(
        day: string,
        month: string,
        year: string,
    ): void {
        component.writeValue(null);

        const inputs = fixture.nativeElement.querySelectorAll(
            'input',
        ) as NodeListOf<HTMLInputElement>;

        const values = [day, month, year];

        inputs.forEach((input, index) => {
            input.value = values[index];
            input.dispatchEvent(
                new Event('input', { bubbles: true }),
            );
        });

        fixture.detectChanges();
    }

    describe('initialization', () => {
        it('should create the component', () => {
            expect(component).toBeTruthy();
        });

        it('should start with empty date fields', () => {
            expect(component.day()).toBe('');
            expect(component.month()).toBe('');
            expect(component.year()).toBe('');
        });

        it('should accept an empty DOB', () => {
            expect(component.validate()).toBeNull();
        });

        it('should load an existing ISO date', () => {
            component.writeValue('1990-05-21');
            fixture.detectChanges();

            expect(component.day()).toBe('21');
            expect(component.month()).toBe('05');
            expect(component.year()).toBe('1990');
            expect(component.validate()).toBeNull();
        });

        it('should clear the date when receiving null', () => {
            component.writeValue('1990-05-21');
            component.writeValue(null);

            expect(component.day()).toBe('');
            expect(component.month()).toBe('');
            expect(component.year()).toBe('');
        });

        it('should not emit changes when writeValue is called', () => {
            component.writeValue('1990-05-21');

            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('manual input', () => {
        it('should emit an ISO date for valid input', () => {
            enterDate('21', '05', '1990');

            expect(component.validate()).toBeNull();
            expect(onChange).toHaveBeenLastCalledWith(
                '1990-05-21',
            );
        });

        it('should accept historical birth dates', () => {
            enterDate('01', '01', '1970');

            expect(component.validate()).toBeNull();
            expect(onChange).toHaveBeenLastCalledWith(
                '1970-01-01',
            );
        });

        it('should remove nonnumeric characters', () => {
            const input = fixture.nativeElement.querySelector(
                '#dob-day',
            ) as HTMLInputElement;

            input.value = 'a3b';
            input.dispatchEvent(
                new Event('input', { bubbles: true }),
            );

            fixture.detectChanges();

            expect(component.day()).toBe('3');
            expect(input.value).toBe('3');
        });

        it('should limit day and month to two digits', () => {
            enterDate('123', '056', '1990');

            expect(component.day()).toBe('12');
            expect(component.month()).toBe('05');
        });

        it('should limit year to four digits', () => {
            enterDate('21', '05', '199012');

            expect(component.year()).toBe('1990');
        });

        it('should normalize single-digit day to 03', () => {
            enterDate('3', '05', '1990');

            component.normalizePart('day');
            fixture.detectChanges();

            expect(component.day()).toBe('03');
            expect(onChange).toHaveBeenLastCalledWith(
                '1990-05-03',
            );
        });

        it('should normalize single-digit month to 05', () => {
            enterDate('21', '5', '1990');

            component.normalizePart('month');
            fixture.detectChanges();

            expect(component.month()).toBe('05');
            expect(onChange).toHaveBeenLastCalledWith(
                '1990-05-21',
            );
        });

        it('should not normalize invalid month values', () => {
            enterDate('21', '15', '1990');

            component.normalizePart('month');

            expect(component.month()).toBe('15');
            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });

        it('should preserve the four-digit year', () => {
            enterDate('21', '05', '1990');

            component.normalizePart('year');

            expect(component.year()).toBe('1990');
        });
    });

    describe('dropdown selection', () => {
        it('should open and close a dropdown', () => {
            component.toggleDropdown('month');

            expect(component.openField()).toBe('month');

            component.toggleDropdown('month');

            expect(component.openField()).toBeNull();
        });

        it('should suggest 05 when typing month 5', () => {
            const monthInput = fixture.nativeElement.querySelector(
                '#dob-month',
            ) as HTMLInputElement;

            monthInput.value = '5';
            monthInput.dispatchEvent(
                new Event('input', { bubbles: true }),
            );

            fixture.detectChanges();

            expect(component.openField()).toBe('month');
            expect(component.visibleOptions('month')).toContain('05');
        });

        it('should suggest 03 when typing day 3', () => {
            const dayInput = fixture.nativeElement.querySelector(
                '#dob-day',
            ) as HTMLInputElement;

            dayInput.value = '3';
            dayInput.dispatchEvent(
                new Event('input', { bubbles: true }),
            );

            fixture.detectChanges();

            expect(component.openField()).toBe('day');
            expect(component.visibleOptions('day')).toContain('03');
        });

        it('should select a dropdown value', () => {
            component.writeValue('1990-01-21');
            component.toggleDropdown('month');

            component.selectOption('month', '05');

            expect(component.month()).toBe('05');
            expect(component.openField()).toBeNull();
            expect(onChange).toHaveBeenLastCalledWith(
                '1990-05-21',
            );
        });

        it('should highlight the selected year on reopening', () => {
            component.writeValue('1990-05-21');

            component.toggleDropdown('year');

            expect(component.openField()).toBe('year');
            expect(
                component.visibleOptions('year')[
                    component.activeIndex()
                ],
            ).toBe('1990');
        });

        it('should include 2000 and earlier historical years', () => {
            component.toggleDropdown('year');

            const options = component.visibleOptions('year');

            expect(options).toContain('2000');
            expect(options).toContain('1970');
        });

        it('should not open when disabled', () => {
            component.setDisabledState(true);

            component.toggleDropdown('year');

            expect(component.openField()).toBeNull();
        });
    });

    describe('validation', () => {
        it('should reject an incomplete date', () => {
            enterDate('21', '', '1990');

            expect(component.validate()).toEqual({
                incompleteDate: true,
            });
        });

        it('should reject invalid calendar dates', () => {
            enterDate('31', '04', '1990');

            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });

        it('should reject February 29 in a non-leap year', () => {
            enterDate('29', '02', '2001');

            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });

        it('should accept February 29 in a leap year', () => {
            enterDate('29', '02', '2000');

            expect(component.validate()).toBeNull();
            expect(onChange).toHaveBeenLastCalledWith(
                '2000-02-29',
            );
        });

        it('should reject an invalid month', () => {
            enterDate('21', '13', '1990');

            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });

        it('should reject day zero', () => {
            enterDate('00', '05', '1990');

            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });

        it('should reject a future date', () => {
            const futureYear = String(
                new Date().getFullYear() + 1,
            );

            enterDate('01', '01', futureYear);

            expect(component.validate()).toEqual({
                futureDate: true,
            });
        });

        it('should notify Angular when validation changes', () => {
            enterDate('21', '05', '1990');

            expect(onValidatorChange).toHaveBeenCalled();
        });
    });

    describe('ControlValueAccessor', () => {
        it('should call onTouched only once', () => {
            component.markTouched();
            component.markTouched();

            expect(onTouched).toHaveBeenCalledOnce();
        });

        it('should update disabled state', () => {
            component.setDisabledState(true);
            fixture.detectChanges();

            const inputs = fixture.nativeElement.querySelectorAll(
                'input',
            ) as NodeListOf<HTMLInputElement>;

            expect(component.disabled()).toBe(true);

            inputs.forEach(input => {
                expect(input.disabled).toBe(true);
            });
        });

        it('should allow re-enabling the component', () => {
            component.setDisabledState(true);
            component.setDisabledState(false);

            expect(component.disabled()).toBe(false);
        });

        it('should emit an empty value for an invalid date', () => {
            enterDate('31', '02', '1990');

            expect(onChange).toHaveBeenLastCalledWith('');
            expect(component.validate()).toEqual({
                invalidDate: true,
            });
        });
    });
});
