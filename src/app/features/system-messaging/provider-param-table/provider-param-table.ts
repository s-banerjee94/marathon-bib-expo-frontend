import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ParamLocation, ProviderParam } from '../../../core/models/system-messaging.model';
import { PARAM_LOCATION_OPTIONS } from '../system-messaging.constants';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

// Controlled, ordered editor for a provider's header/query parameters. The parent owns
// the array and reflects changes via (paramsChange). Each row is a name + location +
// free-text value that may embed {{TOKEN}} placeholders.
@Component({
  selector: 'app-provider-param-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputTextModule, SelectModule, ButtonModule, TooltipModule],
  templateUrl: './provider-param-table.html',
  styleUrl: './provider-param-table.css',
})
export class ProviderParamTable {
  readonly params = input<ProviderParam[]>([]);
  readonly paramsChange = output<ProviderParam[]>();

  readonly inputSize = FORM_INPUT_SIZE;
  readonly locationOptions = PARAM_LOCATION_OPTIONS;

  add(): void {
    const next: ProviderParam = { name: '', location: 'QUERY', value: '' };
    this.paramsChange.emit([...this.params(), next]);
  }

  remove(index: number): void {
    this.paramsChange.emit(this.params().filter((_, i) => i !== index));
  }

  move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const list = this.params();
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    this.paramsChange.emit(next);
  }

  setName(index: number, name: string): void {
    this.patch(index, { name });
  }

  setLocation(index: number, location: ParamLocation): void {
    this.patch(index, { location });
  }

  setValue(index: number, value: string): void {
    this.patch(index, { value });
  }

  private patch(index: number, patch: Partial<ProviderParam>): void {
    this.paramsChange.emit(
      this.params().map((param, i) => (i === index ? { ...param, ...patch } : param)),
    );
  }
}
