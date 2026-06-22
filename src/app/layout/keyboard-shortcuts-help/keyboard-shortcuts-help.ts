import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { JoinPipe } from '../../shared/pipes/join.pipe';
import { KeyboardService } from '../../core/services/keyboard.service';

/**
 * Help overlay for the global keyboard shortcuts, opened with `?`. A thin modal
 * that renders {@link KeyboardService.helpGroups} — the single source of truth —
 * so it always lists exactly the shortcuts available to the current user.
 */
@Component({
  selector: 'app-keyboard-shortcuts-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, JoinPipe],
  templateUrl: './keyboard-shortcuts-help.html',
})
export class KeyboardShortcutsHelp {
  protected readonly keyboard = inject(KeyboardService);
}
