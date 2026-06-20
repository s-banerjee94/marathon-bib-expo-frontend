import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import {
  ChatHistoryResponse,
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from '../models/ai-assistant.model';
import { UserRole } from '../models/user.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { ErrorHandlerService } from './error-handler.service';
import { AuthService } from './auth.service';

// Backend caps a single message at 4000 chars (400 otherwise) and a turn can
// take a few seconds with no streaming, so we wait up to 60s before giving up.
const MAX_MESSAGE_LENGTH = 4000;
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * In-app conversational assistant, backed by GET/POST/DELETE /api/ai/chat.
 *
 * The backend keeps a single per-user session, remembers context on its own,
 * and now persists the transcript — so there is no conversationId to track:
 * GET restores history, every turn is another POST, and DELETE is "New chat".
 * History is loaded lazily the first time the panel opens. State is a root
 * singleton, so it is reset on sign-out to never leak between users.
 */
@Injectable({
  providedIn: 'root',
})
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${BASE_URI}/ai/chat`;

  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  private readonly messagesSignal = signal<ChatMessage[]>([]);
  private readonly sendingSignal = signal(false);
  private readonly openSignal = signal(false);
  private readonly loadingHistorySignal = signal(false);
  private historyLoaded = false;

  // Monotonic counter for client-generated ids (user bubbles). Avoids
  // crypto.randomUUID(), which only exists in a secure context — it is
  // undefined over plain-HTTP LAN access (e.g. a phone hitting
  // http://<laptop-ip>:4200) and would throw on send.
  private nextMessageId = 0;

  readonly messages = this.messagesSignal.asReadonly();
  /** True while a turn is in flight — drives the typing indicator and disables input. */
  readonly sending = this.sendingSignal.asReadonly();
  readonly isOpen = this.openSignal.asReadonly();
  /** True while restoring the stored transcript on first open. */
  readonly loadingHistory = this.loadingHistorySignal.asReadonly();

  /** The assistant is available to every signed-in role except DISTRIBUTOR. */
  readonly available = computed(
    () => this.auth.isAuthenticated() && !this.auth.hasRole(UserRole.DISTRIBUTOR),
  );

  constructor() {
    // Per-user transcript: drop everything on sign-out so the next user starts clean.
    effect(() => {
      if (!this.auth.isAuthenticated()) this.resetLocal();
    });
  }

  open(): void {
    this.setOpen(true);
  }

  setOpen(open: boolean): void {
    this.openSignal.set(open);
    if (open) this.ensureHistoryLoaded();
  }

  toggle(): void {
    this.setOpen(!this.openSignal());
  }

  /** Post one turn. Pushes the user bubble immediately and the reply when it lands. */
  send(text: string): void {
    const message = text.trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH || this.sendingSignal()) return;

    this.append('user', message);
    this.sendingSignal.set(true);

    const body: ChatRequest = { message };
    this.http
      .post<ChatResponse>(this.apiUrl, body)
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.append('assistant', res.reply, res.id);
          this.sendingSignal.set(false);
        },
        error: (error) => {
          this.sendingSignal.set(false);
          this.errorHandler.showError(error);
        },
      });
  }

  /** Clear button: wipe the transcript optimistically and tell the backend to forget. */
  clear(): void {
    if (this.messagesSignal().length === 0) return;

    const previous = this.messagesSignal();
    this.messagesSignal.set([]);

    this.http.delete<void>(this.apiUrl).subscribe({
      error: (error) => {
        this.messagesSignal.set(previous);
        this.errorHandler.showError(error);
      },
    });
  }

  /** Restore the stored transcript once, the first time the panel is opened. */
  private ensureHistoryLoaded(): void {
    if (this.historyLoaded || this.loadingHistorySignal()) return;

    this.loadingHistorySignal.set(true);
    this.http
      .get<ChatHistoryResponse>(this.apiUrl)
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.messagesSignal.set(
            (res.messages ?? []).map((turn) => ({
              id: turn.id,
              role: turn.role === 'USER' ? 'user' : 'assistant',
              text: turn.content,
            })),
          );
          this.historyLoaded = true;
          this.loadingHistorySignal.set(false);
        },
        // Soft, non-interactive load — fail quietly (retry on next open) rather
        // than toast every time the panel opens if the backend hiccups.
        error: () => this.loadingHistorySignal.set(false),
      });
  }

  private resetLocal(): void {
    this.messagesSignal.set([]);
    this.sendingSignal.set(false);
    this.openSignal.set(false);
    this.loadingHistorySignal.set(false);
    this.historyLoaded = false;
  }

  private append(role: ChatMessage['role'], text: string, id?: string): void {
    const messageId = id ?? `${Date.now()}-${this.nextMessageId++}`;
    this.messagesSignal.update((list) => [...list, { id: messageId, role, text }]);
  }
}
