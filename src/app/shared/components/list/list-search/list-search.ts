import { Component, input, output } from '@angular/core';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { FORM_INPUT_SIZE } from '../../../constants/form.constants';

@Component({
  selector: 'app-list-search',
  imports: [IconFieldModule, InputIconModule, InputTextModule],
  templateUrl: './list-search.html',
  styleUrl: './list-search.css',
})
export class ListSearch {
  value = input<string>('');
  placeholder = input<string>('Search (min 2 chars)...');
  isLoading = input<boolean>(false);

  valueChange = output<string>();
  cleared = output<void>();

  readonly inputSize = FORM_INPUT_SIZE;

  onInput(target: EventTarget | null): void {
    this.valueChange.emit((target as HTMLInputElement | null)?.value ?? '');
  }

  onClear(): void {
    this.cleared.emit();
  }
}
