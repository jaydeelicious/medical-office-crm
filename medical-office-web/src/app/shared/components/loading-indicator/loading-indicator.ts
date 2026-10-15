import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  imports: [],
  templateUrl: './loading-indicator.html',
  styleUrl: './loading-indicator.scss',
})
export class LoadingIndicator {
  readonly message = input<string>('Loading...');
}