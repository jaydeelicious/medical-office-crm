import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let dialog: HTMLDialogElement;
  let showModalSpy: ReturnType<typeof vi.fn>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialog);

    fixture.componentRef.setInput('title', 'Delete patient?');
    fixture.componentRef.setInput(
      'message',
      'Are you sure you want to delete this patient?',
    );

    const element: HTMLElement = fixture.nativeElement;
    dialog = element.querySelector('dialog')!;

    // jsdom does not fully implement HTMLDialogElement.
    // Simulate the native methods and their open state.
    Object.defineProperty(dialog, 'open', {
      configurable: true,
      writable: true,
      value: false,
    });

    showModalSpy = vi.fn(() => {
      dialog.open = true;
    });

    closeSpy = vi.fn(() => {
      dialog.open = false;
    });

    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: showModalSpy,
    });

    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: closeSpy,
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the title and message', () => {
    expect(dialog.querySelector('h2')?.textContent).toContain(
      'Delete patient?',
    );

    expect(dialog.querySelector('p')?.textContent).toContain(
      'Are you sure you want to delete this patient?',
    );
  });

  it('should start closed by default', () => {
    expect(dialog.open).toBe(false);
    expect(showModalSpy).not.toHaveBeenCalled();
  });

  it('should open when the open input becomes true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
  });

  it('should close when the open input becomes false', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });

  it('should not open the dialog repeatedly', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    fixture.componentRef.setInput('message', 'Updated message');
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalledOnce();
  });

  it('should display a custom confirmation label', () => {
    fixture.componentRef.setInput('confirmLabel', 'Delete');
    fixture.detectChanges();

    const button = dialog.querySelector('.confirm-button');

    expect(button?.textContent).toContain('Delete');
  });

  it('should emit confirm when the confirmation button is clicked', () => {
    const confirmSpy = vi.fn();

    fixture.componentInstance.confirm.subscribe(confirmSpy);

    const button = dialog.querySelector<HTMLButtonElement>(
      '.confirm-button',
    );

    button?.click();

    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it('should emit cancel when the cancel button is clicked', () => {
    const cancelSpy = vi.fn();

    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const button = dialog.querySelector<HTMLButtonElement>(
      '.cancel-button',
    );

    button?.click();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('should emit cancel and prevent native closing on Escape cancellation', () => {
    const cancelSpy = vi.fn();

    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const event = new Event('cancel', {
      bubbles: false,
      cancelable: true,
    });

    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
  });

  it('should associate the message with the dialog accessibly', () => {
    const descriptionId = dialog.getAttribute('aria-describedby');
    const message = dialog.querySelector('p');

    expect(dialog.getAttribute('aria-label')).toBe('Delete patient?');
    expect(descriptionId).toBeTruthy();
    expect(message?.id).toBe(descriptionId);
  });

  it('should autofocus the safer cancel action', () => {
    const button = dialog.querySelector<HTMLButtonElement>(
      '.cancel-button',
    );

    expect(button?.hasAttribute('autofocus')).toBe(true);
  });

  
  it('should disable actions while processing', () => {
    fixture.componentRef.setInput('isProcessing', true);
    fixture.detectChanges();

    const cancelButton = fixture.nativeElement.querySelector(
      '.cancel-button',
    ) as HTMLButtonElement;

    const confirmButton = fixture.nativeElement.querySelector(
      '.confirm-button',
    ) as HTMLButtonElement;

    expect(cancelButton.disabled).toBe(true);
    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.textContent).toContain('Processing...');
  });

  it('should not emit confirmation or cancellation while processing', () => {
    fixture.componentRef.setInput('isProcessing', true);
    fixture.detectChanges();

    const confirmSpy = vi.fn();
    const cancelSpy = vi.fn();

    fixture.componentInstance.confirm.subscribe(confirmSpy);
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    fixture.componentInstance.onConfirm();
    fixture.componentInstance.onCancel();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

});