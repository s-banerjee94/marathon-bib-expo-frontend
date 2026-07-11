import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TargetField, Mapping, applyConnection } from '../../../core/models/import-mapper.model';

/**
 * Tap-to-select mapper for small/touch screens — the same {@link Mapping}
 * state as the drag mapper, different interaction: tap a CSV column card to
 * open a bottom sheet of target fields, tap a field to connect. Also serves
 * as the keyboard-accessible alternative to drag-and-drop.
 *
 * The sheet is a `p-dialog` (position bottom), not a `p-drawer`: the drawer
 * appends its modal mask to <body> manually and tears it down on an
 * `animationend` it can miss, orphaning an invisible click-eating overlay
 * after the first close (verified against PrimeNG 21.2.13). The dialog's
 * mask is template-rendered, so Angular unmounts it reliably.
 */
@Component({
  selector: 'app-mobile-column-mapper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule],
  templateUrl: './mobile-column-mapper.html',
})
export class MobileColumnMapper {
  /** CSV column headers from the uploaded file. */
  csvColumns = input.required<string[]>();

  /** Target fields — fetched per-event plus the fixed buckets. */
  targetFields = input.required<TargetField[]>();

  /** Sample values per CSV column, rendered under the column name. */
  samples = input<Record<string, string>>({});

  /** Committed connections — two-way bound so the parent can build the JSON. */
  connections = model<Mapping[]>([]);

  /**
   * Column shown in the sheet. Kept after closing (only overwritten on the
   * next open) so the content doesn't blank out during the close animation.
   */
  protected readonly pickerColumn = signal<string | null>(null);

  /** Sheet visibility — two-way bound so mask/✕/escape closes stay in sync. */
  protected readonly sheetOpen = signal(false);

  private readonly fieldByKey = computed(() => new Map(this.targetFields().map((f) => [f.key, f])));

  /** One row per CSV column with its current mapping resolved for display. */
  protected readonly rows = computed(() => {
    const byColumn = new Map(this.connections().map((c) => [c.csvColumn, c.targetField]));
    const fields = this.fieldByKey();
    return this.csvColumns().map((column) => {
      const key = byColumn.get(column);
      return { column, field: key ? (fields.get(key) ?? null) : null };
    });
  });

  /**
   * Sheet entries for the column being mapped: every target field plus the
   * columns already occupying it (a single field's occupant gets replaced).
   */
  protected readonly pickerFields = computed(() => {
    const column = this.pickerColumn();
    const conns = this.connections();
    return this.targetFields().map((field) => {
      const occupants = conns.filter((c) => c.targetField === field.key).map((c) => c.csvColumn);
      return {
        field,
        occupants,
        isCurrent: column !== null && occupants.includes(column),
      };
    });
  });

  protected openPicker(column: string): void {
    this.pickerColumn.set(column);
    this.sheetOpen.set(true);
  }

  protected pick(field: TargetField): void {
    const column = this.pickerColumn();
    if (column === null) return;
    this.connections.set(
      applyConnection(this.connections(), column, field.key, this.targetFields()),
    );
    this.sheetOpen.set(false);
  }

  protected unmap(column: string): void {
    this.connections.set(this.connections().filter((c) => c.csvColumn !== column));
  }

  /** Remove the open column's mapping from inside the sheet. */
  protected unmapCurrent(): void {
    const column = this.pickerColumn();
    if (column !== null) this.unmap(column);
    this.sheetOpen.set(false);
  }

  protected readonly pickerHasMapping = computed(() => {
    const column = this.pickerColumn();
    return column !== null && this.connections().some((c) => c.csvColumn === column);
  });
}
