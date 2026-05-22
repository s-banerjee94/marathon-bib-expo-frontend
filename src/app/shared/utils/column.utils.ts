import { WritableSignal } from '@angular/core';
import { TableColumn } from '../models/table-config.model';
import { LocalStorageService } from '../../core/services/local-storage.service';

/**
 * Initialize column signals from saved localStorage preferences or defaults.
 * Required columns are always included regardless of saved prefs or defaults.
 *
 * Callers pass their injected LocalStorageService — all storage access goes
 * through the central service so logout-wipe stays comprehensive.
 */
export function initializeColumnPreferences(
  storage: LocalStorageService,
  allColumns: TableColumn[],
  defaultFields: string[],
  storageKey: string,
  cols: WritableSignal<TableColumn[]>,
  selectedCols: WritableSignal<TableColumn[]>,
): void {
  cols.set(allColumns);

  const required = allColumns.filter((col) => col.required);
  const savedFields = storage.getJSON<string[]>(storageKey);

  if (Array.isArray(savedFields)) {
    const selected = allColumns.filter((col) => savedFields.includes(col.field));
    if (selected.length > 0) {
      selectedCols.set(mergeRequired(selected, required));
      return;
    }
  }

  const fromDefaults = allColumns.filter((col) => defaultFields.includes(col.field));
  selectedCols.set(mergeRequired(fromDefaults, required));
}

/**
 * Save column selection to localStorage via the central service.
 */
export function saveColumnPreferences(
  storage: LocalStorageService,
  selectedCols: WritableSignal<TableColumn[]>,
  storageKey: string,
): void {
  const selectedFields = selectedCols().map((col) => col.field);
  storage.setJSON(storageKey, selectedFields);
}

/**
 * Compute the columns that should render in the table, in canonical order
 * defined by allColumns. Required columns always appear; non-required columns
 * appear only when present in selectedCols.
 */
export function getVisibleCols(
  allColumns: TableColumn[],
  selectedCols: TableColumn[],
): TableColumn[] {
  const selectedFields = new Set(selectedCols.map((c) => c.field));
  return allColumns.filter((col) => col.required || selectedFields.has(col.field));
}

/**
 * Ensure required columns are present in selectedCols. Use in
 * onColumnSelectionChange to recover from corrupted state.
 */
export function enforceRequiredColumns(
  selectedCols: WritableSignal<TableColumn[]>,
  allColumns: TableColumn[],
): void {
  const required = allColumns.filter((col) => col.required);
  const current = selectedCols();
  const missing = required.filter((r) => !current.some((c) => c.field === r.field));
  if (missing.length > 0) {
    selectedCols.set([...current, ...missing]);
  }
}

function mergeRequired(selected: TableColumn[], required: TableColumn[]): TableColumn[] {
  const missing = required.filter((r) => !selected.some((c) => c.field === r.field));
  return [...selected, ...missing];
}
