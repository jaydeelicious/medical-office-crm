import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateOfBirthPicker } from './date-of-birth-picker';

describe('DateOfBirthPicker', () => {
  let component: DateOfBirthPicker;
  let fixture: ComponentFixture<DateOfBirthPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateOfBirthPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(DateOfBirthPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
