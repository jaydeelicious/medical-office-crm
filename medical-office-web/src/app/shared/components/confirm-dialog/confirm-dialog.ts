import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextDialogId = 0;

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly messageId = `confirm-dialog-message-${nextDialogId++}`;
  readonly isProcessing = input(false);

  readonly confirm = output<void>();
  readonly cancelled = output<void>();

  private readonly dialog =
    viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;

      if (!dialog) {
        return;
      }

      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  onConfirm(): void {
    if (this.isProcessing()) {
      return;
    }

    this.confirm.emit();
  }

  onCancel(): void {
    if (this.isProcessing()) {
      return;
    }
    
    this.cancelled.emit();
  }

  onNativeCancel(event: Event): void {
    event.preventDefault();
    this.onCancel();
  }
}