import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';

/**
 * Print-only page header for list/report screens.
 *
 * Hidden on screen (`hidden print:block`); only the print stylesheet reveals it.
 * Renders a title, an optional projected meta line (e.g. event name + date) and a
 * "Printed at" stamp captured fresh on each print via the window `beforeprint`
 * event, so the timestamp reflects when the page was printed, not when it loaded.
 */
@Component({
  selector: 'app-print-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './print-header.html',
  styleUrl: './print-header.css',
})
export class PrintHeader {
  private appRef = inject(ApplicationRef);

  title = input.required<string>();

  protected readonly printedAt = signal(new Date());

  @HostListener('window:beforeprint')
  protected stampPrintTime(): void {
    this.printedAt.set(new Date());
    // print() snapshots synchronously without awaiting microtasks, so flush change
    // detection now to render the fresh timestamp before the snapshot is taken.
    this.appRef.tick();
  }
}
