import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal, TemplateRef } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { BadgeModule } from 'primeng/badge';
import { FORM_INPUT_SIZE } from '../../../constants/form.constants';

@Component({
  selector: 'app-list-filter-panel',
  imports: [CommonModule, ButtonModule, DialogModule, BadgeModule],
  templateUrl: './list-filter-panel.html',
  styleUrl: './list-filter-panel.css',
})
export class ListFilterPanel {
  isMobile = input<boolean>(false);
  activeFilterCount = input<number>(0);
  dialogHeader = input<string>('Filters');
  triggerLabel = input<string>('Filters');
  filtersTemplate = input<TemplateRef<unknown> | null>(null);

  // Opt-in Apply button: when true, the dialog renders an Apply button in its
  // footer instead of auto-applying every change. Lets the consumer batch a
  // user's filter edits until they explicitly commit. Emits `applied` on click,
  // and closes the dialog.
  showApply = input<boolean>(false);
  applied = output<void>();

  readonly inputSize = FORM_INPUT_SIZE;
  protected dialogVisible = signal(false);

  protected hasActive = computed(() => this.activeFilterCount() > 0);

  openDialog(): void {
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
  }

  onApply(): void {
    this.applied.emit();
    this.closeDialog();
  }
}
