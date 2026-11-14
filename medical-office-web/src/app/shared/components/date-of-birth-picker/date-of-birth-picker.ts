
import {
    Component,
    ElementRef,
    HostListener,
    forwardRef,
    signal,
    inject,
    Injector,
    afterRenderEffect,
} from '@angular/core';
import {
    ControlValueAccessor,
    NG_VALIDATORS,
    NG_VALUE_ACCESSOR,
    ValidationErrors,
    Validator,
} from '@angular/forms';

type DatePart = 'day' | 'month' | 'year';

@Component({
    selector: 'app-date-of-birth-picker',
    standalone: true,
    templateUrl: './date-of-birth-picker.html',
    styleUrl: './date-of-birth-picker.scss',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DateOfBirthPicker),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => DateOfBirthPicker),
            multi: true,
        },
    ],
})
export class DateOfBirthPicker implements ControlValueAccessor, Validator {
    private readonly elementRef = inject(ElementRef<HTMLElement>);
    private readonly injector = inject(Injector);

    readonly fields: { key: DatePart; label: string }[] = [
        { key: 'day', label: 'Day' },
        { key: 'month', label: 'Month' },
        { key: 'year', label: 'Year' },
    ];

    readonly day = signal('');
    readonly month = signal('');
    readonly year = signal('');

    readonly openField = signal<DatePart | null>(null);
    readonly activeIndex = signal(0);
    readonly disabled = signal(false);
    readonly touched = signal(false);

    private readonly currentYear = new Date().getFullYear();

    private onChange: (value: string) => void = () => undefined;
    private onTouched: () => void = () => undefined;
    private onValidatorChange: () => void = () => undefined;

    constructor() {
        afterRenderEffect(() => {
            const openField = this.openField();

            if (openField !== 'year' || this.filterOptions()) {
                return;
            }

            const year = this.year() || '2000';

            const container: HTMLElement | null =
                this.elementRef.nativeElement.querySelector(
                    '#dob-options-year',
                );

            const target: HTMLElement | null =
                container?.querySelector(
                    `[data-year="${year}"]`,
                ) ?? null;

            if (!container || !target) return;

            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            container.scrollTop +=
                targetRect.top -
                containerRect.top -
                container.clientHeight / 2 +
                target.clientHeight / 2;
        });
    }

    valueOf(part: DatePart): string {
        switch (part) {
            case 'day': return this.day();
            case 'month': return this.month();
            case 'year': return this.year();
        }
    }

    private setPart(part: DatePart, value: string): void {
        switch (part) {
            case 'day': this.day.set(value); break;
            case 'month': this.month.set(value); break;
            case 'year': this.year.set(value); break;
        }
    }

    private optionsFor(part: DatePart): string[] {
        const pad = (n: number) => String(n).padStart(2, '0');

        switch (part) {
            case 'day':
                return Array.from({ length: 31 }, (_, i) => pad(i + 1));

            case 'month':
                return Array.from({ length: 12 }, (_, i) => pad(i + 1));

            case 'year':
                return Array.from(
                    { length: this.currentYear - 1899 },
                    (_, i) => String(this.currentYear - i),
                );
        }
    }

    visibleOptions(part: DatePart): string[] {
        const options = this.optionsFor(part);

        if (this.openField() !== part) {
            return [];
        }

        if (!this.filterOptions()) {
            return options;
        }

        const query = this.valueOf(part);

        if (!query) {
          return options;
        }

        if (part === 'year') {
          return options.filter(option => option.startsWith(query));
        }

        return options.filter(option => {
            const numericOption = String(Number(option));

            return option.startsWith(query) ||
                numericOption.startsWith(query);
        });
    }

    readonly filterOptions = signal(false);

    inputChanged(part: DatePart, event: Event): void {
        const input = event.target as HTMLInputElement;
        const maxLength = part === 'year' ? 4 : 2;

        const value = input.value.replace(/\D/g, '').slice(0, maxLength);
        input.value = value;

        this.setPart(part, value);
        this.openField.set(part);
        this.filterOptions.set(true);
        this.activeIndex.set(0);

        this.emitValue();
    }

    toggleDropdown(part: DatePart): void {
        if (this.disabled()) return;

        if (this.openField() === part) {
            this.closeDropdown();
            return;
        }

        this.openField.set(part);
        this.filterOptions.set(false);

        const options = this.optionsFor(part);
        const selectedIndex = options.indexOf(this.valueOf(part));

        this.activeIndex.set(Math.max(0, selectedIndex));
    }

    selectOption(part: DatePart, value: string): void {
        this.setPart(part, value);
        this.closeDropdown();
        this.emitValue();
        this.markTouched();
    }

    handleKeydown(part: DatePart, event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.closeDropdown();
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();

            if (this.openField() !== part) {
                this.openField.set(part);
                this.filterOptions.set(false);
                this.activeIndex.set(0);
                return;
            }

            const options = this.visibleOptions(part);
            if (options.length === 0) return;

            const direction = event.key === 'ArrowDown' ? 1 : -1;
            this.activeIndex.set(
                Math.max(0, Math.min(
                    options.length - 1,
                    this.activeIndex() + direction,
                )),
            );
        }

        if (event.key === 'Enter' && this.openField() === part) {
            const option = this.visibleOptions(part)[this.activeIndex()];

            if (option) {
                event.preventDefault();
                this.selectOption(part, option);
            }
        }
    }

    private closeDropdown(): void {
        this.openField.set(null);
        this.filterOptions.set(false);
    }

    @HostListener('document:pointerdown', ['$event'])
    onDocumentPointerDown(event: PointerEvent): void {
        if (!this.elementRef.nativeElement.contains(event.target as Node)) {
            this.closeDropdown();
        }
    }

    markTouched(): void {
        if (!this.touched()) {
            this.touched.set(true);
            this.onTouched();
        }
    }

    writeValue(value: string | null): void {
        if (!value) {
            this.day.set('');
            this.month.set('');
            this.year.set('');
            return;
        }

        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

        if (match) {
            this.year.set(match[1]);
            this.month.set(match[2]);
            this.day.set(match[3]);
        } else {
            this.day.set('');
            this.month.set('');
            this.year.set('');
        }
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled.set(isDisabled);
        if (isDisabled) this.closeDropdown();
    }

    registerOnValidatorChange(fn: () => void): void {
        this.onValidatorChange = fn;
    }

    validate(): ValidationErrors | null {
        const day = this.day();
        const month = this.month();
        const year = this.year();

        if (!day && !month && !year) {
            return null;
        }

        if (!day || !month || !year) {
            return { incompleteDate: true };
        }

        if (!/^\d{1,2}$/.test(day) ||
            !/^\d{1,2}$/.test(month) ||
            !/^\d{4}$/.test(year)) {
            return { invalidDate: true };
        }

        const d = Number(day);
        const m = Number(month);
        const y = Number(year);

        if (y < 1 || m < 1 || m > 12 || d < 1) {
            return { invalidDate: true };
        }

        const leapYear =
            y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

        const daysInMonth = [
            31, leapYear ? 29 : 28, 31, 30,
            31, 30, 31, 31, 30, 31, 30, 31,
        ];

        if (d > daysInMonth[m - 1]) {
            return { invalidDate: true };
        }

        const today = new Date();

        if (
            y > today.getFullYear() ||
            (y === today.getFullYear() && m > today.getMonth() + 1) ||
            (y === today.getFullYear() &&
                m === today.getMonth() + 1 &&
                d > today.getDate())
        ) {
            return { futureDate: true };
        }

        return null;
    }

    normalizePart(part: DatePart): void {
        if (part === 'year') {
            return;
        }

        const value = this.valueOf(part);

        if (!value || value.length !== 1) {
            return;
        }

        const number = Number(value);
        const maximum = part === 'day' ? 31 : 12;

        if (number < 1 || number > maximum) {
            return;
        }

        this.setPart(part, value.padStart(2, '0'));
        this.emitValue();
    }

    private emitValue(): void {
        const valid = this.validate() === null;
        const hasValue = this.day() || this.month() || this.year();

        let value = '';

        if (valid && hasValue) {
            const year = this.year();
            const month = this.month().padStart(2, '0');
            const day = this.day().padStart(2, '0');

            value = `${year}-${month}-${day}`;
        }

        this.onChange(value);
        this.onValidatorChange();
    }

    getError(): string | null {
        const errors = this.validate();

        if (errors?.['incompleteDate']) {
            return 'Enter a complete date of birth.';
        }

        if (errors?.['futureDate']) {
            return 'Date of birth cannot be in the future.';
        }

        if (errors?.['invalidDate']) {
            return 'Enter a valid date of birth.';
        }

        return null;
    }
}
