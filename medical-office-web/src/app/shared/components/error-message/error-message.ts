import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-message',
  imports: [],
  templateUrl: './error-message.html',
  styleUrl: './error-message.scss',
})
export class ErrorMessage {
  readonly message = input.required<string>();
  readonly retryable = input(false);

  readonly retry = output<void>();

  onRetry(): void {
    this.retry.emit();
  }
}