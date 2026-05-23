import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';

export type FloatingProgressSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export type FloatingProgressId = string | number;

const BASE_OFFSET_PX = 16;
const STACK_OFFSET_PX = 90;
const TAB_WIDTH_PX = 24;
const TAB_HEIGHT_PX = 80;
const WIDTH = '290px';

@Component({
  selector: 'app-floating-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './floating-progress.html',
  imports: [DialogModule, ButtonModule, TagModule, BadgeModule],
})
export class FloatingProgress {
  id = input.required<FloatingProgressId>();

  title = input<string>('');
  status = input<string>('');
  severity = input<FloatingProgressSeverity>('secondary');

  index = input<number>(0);

  dismissed = output<FloatingProgressId>();

  minimized = signal<boolean>(false);

  private stackBottomPx = computed(() => BASE_OFFSET_PX + this.index() * STACK_OFFSET_PX);

  dialogStyle = computed(() => ({
    position: 'fixed',
    right: '16px',
    bottom: this.stackBottomPx() + 'px',
    width: WIDTH,
    maxWidth: '95vw',
    height: 'fit-content',
    minHeight: '0',
    top: 'auto',
    left: 'auto',
  }));

  tabStyle = computed(() => ({
    position: 'fixed',
    right: '0',
    bottom: this.stackBottomPx() + 'px',
    width: TAB_WIDTH_PX + 'px',
    height: TAB_HEIGHT_PX + 'px',
    zIndex: '1100',
    backgroundColor: 'var(--p-content-background)',
    border: 'none',
  }));

  minimize(): void {
    this.minimized.set(true);
  }

  restore(): void {
    this.minimized.set(false);
  }

  onDismiss(): void {
    this.dismissed.emit(this.id());
  }
}
