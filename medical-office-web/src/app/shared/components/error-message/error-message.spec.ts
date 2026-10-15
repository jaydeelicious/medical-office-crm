import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ErrorMessage } from './error-message';

describe('ErrorMessage', () => {
  let fixture: ComponentFixture<ErrorMessage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorMessage],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorMessage);
    fixture.componentRef.setInput('message', 'Unable to load patients.');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the provided error message', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Unable to load patients.');
  });

  it('should expose an accessible alert', () => {
    const element: HTMLElement = fixture.nativeElement;

    const alert = element.querySelector('[role="alert"]');

    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Unable to load patients.');
  });

  it('should not display a retry button by default', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('button')).toBeNull();
  });

  it('should display a retry button when retryable is true', () => {
    fixture.componentRef.setInput('retryable', true);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button');

    expect(button?.textContent).toContain('Retry');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('should emit retry when the retry button is clicked', () => {
    const retrySpy = vi.fn();

    fixture.componentInstance.retry.subscribe(retrySpy);

    fixture.componentRef.setInput('retryable', true);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button');

    expect(button).not.toBeNull();

    button?.click();

    expect(retrySpy).toHaveBeenCalledOnce();
  });
});