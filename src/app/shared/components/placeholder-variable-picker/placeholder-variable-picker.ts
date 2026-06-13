import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FORM_INPUT_SIZE } from '../../constants/form.constants';
import { PLACEHOLDER_MAP } from '../../constants/sms-template-placeholders.constant';

export interface PlaceholderOption {
  value: string;
  label: string;
}

// Controlled, ordered picker for #{field} placeholder variables. Each entry maps
// to a positional Content-template variable ({{1}}, {{2}}, …). The parent owns the
// array and reflects changes via (variablesChange). Shared by the WhatsApp template
// form and the WhatsApp test-send dialog.
@Component({
  selector: 'app-placeholder-variable-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, ButtonModule, TooltipModule],
  templateUrl: './placeholder-variable-picker.html',
  styleUrl: './placeholder-variable-picker.css',
})
export class PlaceholderVariablePicker {
  variables = input<string[]>([]);
  maxVariables = input(20);
  // Optional override of the placeholder catalog; defaults to the participant/event
  // PLACEHOLDER_MAP so existing callers keep their behavior.
  options = input<PlaceholderOption[] | undefined>(undefined);
  variablesChange = output<string[]>();

  readonly inputSize = FORM_INPUT_SIZE;

  private readonly defaultOptions: PlaceholderOption[] = Object.entries(PLACEHOLDER_MAP).map(
    ([field, label]) => ({
      value: `#{${field}}`,
      label: `${label} — #{${field}}`,
    }),
  );

  readonly resolvedOptions = computed<PlaceholderOption[]>(
    () => this.options() ?? this.defaultOptions,
  );

  add(): void {
    const list = this.variables();
    if (list.length >= this.maxVariables()) return;
    const first = this.resolvedOptions()[0]?.value ?? '';
    this.variablesChange.emit([...list, first]);
  }

  remove(index: number): void {
    this.variablesChange.emit(this.variables().filter((_, i) => i !== index));
  }

  update(index: number, value: string): void {
    this.variablesChange.emit(this.variables().map((v, i) => (i === index ? value : v)));
  }

  move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const list = this.variables();
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    this.variablesChange.emit(next);
  }
}
