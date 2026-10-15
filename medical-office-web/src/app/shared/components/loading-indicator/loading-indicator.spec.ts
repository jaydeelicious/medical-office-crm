import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingIndicator } from './loading-indicator';

describe('LoadingIndicator', () => {
  let component: LoadingIndicator;
  let fixture: ComponentFixture<LoadingIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingIndicator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the default loading message', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Loading...');
  });

  it('should display a custom loading message', () => {
    fixture.componentRef.setInput('message', 'Loading patients...');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Loading patients...');
  });

  it('should expose an accessible status', () => {
    const element: HTMLElement = fixture.nativeElement;

    const status = element.querySelector('[role="status"]');
    const spinner = element.querySelector('.spinner');

    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('Loading...');
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });
});