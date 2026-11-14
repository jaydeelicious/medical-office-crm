import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientQuickCreate } from './patient-quick-create';

describe('PatientQuickCreate', () => {
  let component: PatientQuickCreate;
  let fixture: ComponentFixture<PatientQuickCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientQuickCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientQuickCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
