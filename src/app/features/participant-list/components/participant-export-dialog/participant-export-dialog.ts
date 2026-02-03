import { Component, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableColumn } from '../../../../shared/models/table-config.model';

@Component({
  selector: 'app-participant-export-dialog',
  standalone: true,
  templateUrl: './participant-export-dialog.html',
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, MultiSelectModule],
})
export class ParticipantExportDialog {
  visible = model<boolean>(false);
  allColumns = input.required<TableColumn[]>();
  isExporting = input<boolean>(false);

  exportConfirmed = output<TableColumn[]>();

  selectedColumns = signal<TableColumn[]>([]);

  onShow(): void {
    // Set default columns when dialog opens
    const defaults = this.allColumns().filter(
      (col) =>
        col.field === 'bibNumber' ||
        col.field === 'chipNumber' ||
        col.field === 'fullName' ||
        col.field === 'email' ||
        col.field === 'phoneNumber' ||
        col.field === 'raceName' ||
        col.field === 'categoryName' ||
        col.field === 'gender',
    );
    this.selectedColumns.set(defaults);
  }

  close(): void {
    if (!this.isExporting()) {
      this.visible.set(false);
      this.selectedColumns.set([]);
    }
  }

  confirm(): void {
    this.exportConfirmed.emit(this.selectedColumns());
  }
}
