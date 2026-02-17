import { WritableSignal } from '@angular/core';
import { TableColumn } from '../models/table-config.model';

/**
 * Initialize column signals from saved localStorage preferences or defaults.
 * Centralizes the repeated pattern across section components.
 */
export function initializeColumnPreferences(
  allColumns: TableColumn[],
  defaultFields: string[],
  storageKey: string,
  cols: WritableSignal<TableColumn[]>,
  selectedCols: WritableSignal<TableColumn[]>,
): void {
  cols.set(allColumns);

  const savedColumns = localStorage.getItem(storageKey);
  if (savedColumns) {
    try {
      const savedFields = JSON.parse(savedColumns) as string[];
      const selectedColumns = allColumns.filter((col) => savedFields.includes(col.field));
      if (selectedColumns.length > 0) {
        selectedCols.set(selectedColumns);
        return;
      }
    } catch {
      // Fall through to defaults
    }
  }

  selectedCols.set(allColumns.filter((col) => defaultFields.includes(col.field)));
}

/**
 * Save column selection to localStorage.
 */
export function saveColumnPreferences(
  selectedCols: WritableSignal<TableColumn[]>,
  storageKey: string,
): void {
  const selectedFields = selectedCols().map((col) => col.field);
  localStorage.setItem(storageKey, JSON.stringify(selectedFields));
}
