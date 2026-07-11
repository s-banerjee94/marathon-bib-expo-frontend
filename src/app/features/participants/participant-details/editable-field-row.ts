import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';

@Component({
  selector: 'app-editable-field-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TooltipModule, DefaultValuePipe],
  template: `
    <div
      class="flex items-start justify-between gap-2 py-1.5 border-b border-surface-200 dark:border-surface-700 last:border-b-0"
    >
      <div class="flex-1 min-w-0">
        <p class="text-xs uppercase tracking-wide text-muted-color mb-0.5">{{ label() }}</p>
        @if (editing()) {
          <ng-content />
        } @else {
          <p class="text-sm font-medium break-words">{{ displayValue() | defaultValue }}</p>
        }
      </div>

      @if (editable()) {
        @if (editing()) {
          <div class="flex gap-1 flex-shrink-0 mt-4">
            <p-button
              (onClick)="confirm.emit()"
              [loading]="saving()"
              [disabled]="disabledConfirm() || saving()"
              [rounded]="true"
              [text]="true"
              icon="pi pi-check"
              pTooltip="Save"
              severity="success"
              size="small"
              tooltipPosition="top"
            />
            <p-button
              (onClick)="cancelled.emit()"
              [disabled]="saving()"
              [rounded]="true"
              [text]="true"
              icon="pi pi-times"
              pTooltip="Cancel"
              severity="secondary"
              size="small"
              tooltipPosition="top"
            />
          </div>
        } @else {
          <p-button
            (onClick)="startEdit.emit()"
            [rounded]="true"
            [text]="true"
            icon="pi pi-pencil"
            pTooltip="Edit"
            severity="secondary"
            size="small"
            tooltipPosition="top"
          />
        }
      }
    </div>
  `,
})
export class EditableFieldRow {
  label = input.required<string>();
  displayValue = input<string | number | null | undefined>(undefined);
  editable = input<boolean>(false);
  editing = input<boolean>(false);
  saving = input<boolean>(false);
  disabledConfirm = input<boolean>(false);

  startEdit = output<void>();
  confirm = output<void>();
  cancelled = output<void>();
}
