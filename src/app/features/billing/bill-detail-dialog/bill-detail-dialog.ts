import { Component, computed, input, model, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { BillResponse } from '../../../core/models/billing.model';
import { BUTTON_SIZE } from '../../../shared/constants/form.constants';
import { BillDetail } from '../bill-detail/bill-detail';

/**
 * Thin dialog wrapper around `BillDetail`, used from the org / platform bill tables
 * (the event Bills tab renders `BillDetail` inline instead). Forwards the bill and
 * its mutation events; the host patches its list from `billChange`.
 */
@Component({
  selector: 'app-bill-detail-dialog',
  imports: [DialogModule, ButtonModule, BillDetail],
  templateUrl: './bill-detail-dialog.html',
  styleUrl: './bill-detail-dialog.css',
})
export class BillDetailDialog {
  bill = input<BillResponse | null>(null);
  eventId = input<number>(0);
  canManage = input<boolean>(false);
  visible = model<boolean>(false);

  billChange = output<BillResponse>();
  issueFinal = output<void>();

  protected readonly buttonSize = BUTTON_SIZE;

  protected readonly dialogHeader = computed(() => {
    const b = this.bill();
    if (!b) return 'Bill details';
    return b.invoiceNumber ? `Invoice ${b.invoiceNumber}` : 'Draft bill';
  });
}
