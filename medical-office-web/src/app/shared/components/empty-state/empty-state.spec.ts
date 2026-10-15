import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyState],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'No patients found');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the required title', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('h2')?.textContent).toContain(
      'No patients found',
    );
  });

  it('should display a description when provided', () => {
    fixture.componentRef.setInput(
      'description',
      'Add your first patient to get started.',
    );
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('p')?.textContent).toContain(
      'Add your first patient to get started.',
    );
  });

  it('should not render a description when omitted', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('p')).toBeNull();
  });

  it('should hide the decorative icon from assistive technologies', () => {
    const element: HTMLElement = fixture.nativeElement;
    const icon = element.querySelector('.empty-state-icon');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state title="No doctors found">
      <button type="button" (click)="onAddDoctor()">
        Add doctor
      </button>
    </app-empty-state>
  `,
})
class TestHost {
  readonly clicked = signal(false);

  onAddDoctor(): void {
    this.clicked.set(true);
  }
}

describe('EmptyState content projection', () => {
  it('should project an interactive action button', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button');

    expect(button?.textContent).toContain('Add doctor');

    button?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.clicked()).toBe(true);
  });
});