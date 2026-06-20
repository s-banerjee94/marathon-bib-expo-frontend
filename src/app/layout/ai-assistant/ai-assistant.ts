import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { LayoutService } from '../../core/services/layout.service';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';

const FAB_SIZE = 56;
const POPUP_WIDTH = 352;
const POPUP_HEIGHT = 560;
const EDGE_GAP = 16;
// Movement under this many px counts as a click (toggle) rather than a drag.
const DRAG_THRESHOLD = 5;

@Component({
  selector: 'app-ai-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, ButtonModule, TextareaModule, MarkdownPipe],
  templateUrl: './ai-assistant.html',
})
export class AiAssistant {
  protected readonly assistant = inject(AiAssistantService);
  protected readonly layout = inject(LayoutService);

  protected readonly draft = signal('');

  // Popup-mode floating button position (top-left, px), draggable; starts bottom-right.
  protected readonly fabPos = signal(this.initialFabPos());

  // Popup window anchored just above the button, clamped to the viewport.
  protected readonly popupPos = computed(() => {
    const fab = this.fabPos();
    const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
    return {
      left: this.clamp(fab.x + FAB_SIZE - POPUP_WIDTH, EDGE_GAP, vw - POPUP_WIDTH - EDGE_GAP),
      top: this.clamp(fab.y - POPUP_HEIGHT - 8, EDGE_GAP, vh - POPUP_HEIGHT - EDGE_GAP),
    };
  });

  private readonly scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');

  private dragging = false;
  private moved = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private fabStartX = 0;
  private fabStartY = 0;

  constructor() {
    effect(() => {
      this.assistant.messages();
      this.assistant.sending();
      setTimeout(() => this.scrollToBottom());
    });
  }

  protected onSend(): void {
    const text = this.draft();
    if (!text.trim() || this.assistant.sending()) return;
    this.assistant.send(text);
    this.draft.set('');
  }

  protected onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    this.onSend();
  }

  protected onFabPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.moved = 0;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    const pos = this.fabPos();
    this.fabStartX = pos.x;
    this.fabStartY = pos.y;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onFabPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.pointerStartX;
    const dy = event.clientY - this.pointerStartY;
    this.moved = Math.max(this.moved, Math.abs(dx) + Math.abs(dy));
    this.fabPos.set({
      x: this.clamp(this.fabStartX + dx, EDGE_GAP, window.innerWidth - FAB_SIZE - EDGE_GAP),
      y: this.clamp(this.fabStartY + dy, EDGE_GAP, window.innerHeight - FAB_SIZE - EDGE_GAP),
    });
  }

  protected onFabPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    // A tap (no meaningful drag) toggles the chat window.
    if (this.moved < DRAG_THRESHOLD) this.assistant.toggle();
  }

  private initialFabPos(): { x: number; y: number } {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: window.innerWidth - FAB_SIZE - EDGE_GAP - 8,
      y: window.innerHeight - FAB_SIZE - EDGE_GAP - 8,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  private scrollToBottom(): void {
    const el = this.scrollArea()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
