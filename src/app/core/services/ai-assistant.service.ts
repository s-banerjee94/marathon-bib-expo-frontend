import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AgentAttachmentKind,
  AgentAttachmentsResponse,
  AgentChatRequest,
  AgentHistoryAttachment,
  AgentDecision,
  AgentHistoryMessage,
  AgentHistoryRequest,
  AgentHistoryResponse,
  AgentMode,
  AgentPendingAction,
  AgentPendingResponse,
  AgentResumeRequest,
  AgentTool,
  AgentToolSettings,
  AgentToolSettingsRequest,
  AgentUsageResponse,
  ChatAttachment,
  ChatMessage,
  StagedAttachment,
} from '../models/ai-assistant.model';
import { UserRole } from '../models/user.model';
import { AI_BASE_URI } from '../../shared/constants/api.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { AI_REQUEST } from '../interceptors/http-context-tokens';
import { ErrorHandlerService } from './error-handler.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { LocalStorageService } from './local-storage.service';

// Backend caps a single message at 4000 chars. The reply is streamed token by
// token; the timeout guards inactivity — give up if no first byte, or no further
// event, arrives within 60s.
const MAX_MESSAGE_LENGTH = 4000;
const REQUEST_TIMEOUT_MS = 60_000;

const AGENT_MODES: readonly AgentMode[] = ['ask', 'agent', 'auto'];

// Attachment limits mirror the backend (POST /chat/attachments): at most 2 files
// per message, images ≤ 2 MB (PNG/JPEG/WEBP/GIF), PDFs ≤ 1 MB. We validate
// client-side too so bad files are rejected before an upload round-trip.
const MAX_ATTACHMENTS = 2;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 1 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * In-app conversational assistant, backed by the agent at POST /chat/stream and
 * POST /chat/resume/stream (the Python AI service, served at the host root — NOT
 * under the Java `/api` prefix — and reached same-origin via the dev proxy).
 *
 * The reply is streamed as Server-Sent Events and the text is appended token by
 * token. We read it with fetch() + ReadableStream (not HttpClient/EventSource):
 * EventSource can't POST or set Authorization, and fetch lets us read the chunked
 * body unbuffered and send the bearer token with NO cookies — the AI service is a
 * separate origin with Bearer-only auth, so credential-less requests are what its
 * wildcard CORS allows. SSE events: `token` {text} (append), `needs_approval`
 * {pending[]} (writes await sign-off — the stream ends, then we resume), `done`
 * {reply} (the final assembled reply), `error` {detail} (a mid-stream failure).
 * The other AI calls (usage / history / memory) go through HttpClient flagged
 * AI_REQUEST, which likewise sends the bearer token without cookies or CSRF.
 *
 * The agent keeps one conversation per user server-side, so we never resend
 * history — just the new message. For an approval round we collect one decision
 * per action and POST /chat/resume/stream, looping until `done`. State is a root
 * singleton, reset on sign-out to never leak between users.
 *
 * The transcript is restored on first open from POST /chat/history (paged,
 * newest page first, older pages prepended via `cursor`); a history line flagged
 * `summary` renders an "earlier turns summarized" divider. DELETE /chat/memory
 * clears server-side memory; `resetConversation()` calls it and drops the local
 * transcript. GET /chat/usage exposes the daily token budget; a 429 (budget
 * exhausted) surfaces a verbatim `limitNotice` that blocks the composer until
 * reset (UTC midnight) or "New chat".
 */
@Injectable({
  providedIn: 'root',
})
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(LocalStorageService);
  private readonly streamUrl = `${AI_BASE_URI}/chat/stream`;
  private readonly resumeStreamUrl = `${AI_BASE_URI}/chat/resume/stream`;
  private readonly memoryUrl = `${AI_BASE_URI}/chat/memory`;
  private readonly usageUrl = `${AI_BASE_URI}/chat/usage`;
  private readonly historyUrl = `${AI_BASE_URI}/chat/history`;
  private readonly pendingUrl = `${AI_BASE_URI}/chat/pending`;
  private readonly toolsUrl = `${AI_BASE_URI}/chat/tools`;
  private readonly attachmentsUrl = `${AI_BASE_URI}/chat/attachments`;

  readonly maxMessageLength = MAX_MESSAGE_LENGTH;
  readonly maxAttachments = MAX_ATTACHMENTS;
  /** `accept` string for the file picker — derived from the one validated MIME list. */
  readonly acceptTypes = [...IMAGE_MIME_TYPES, 'application/pdf'].join(',');

  private readonly messagesSignal = signal<ChatMessage[]>([]);
  private readonly sendingSignal = signal(false);
  // The assistant message currently being streamed (null between turns / before
  // the first token); tokens are appended to its text as they arrive.
  private readonly streamingIdSignal = signal<string | null>(null);
  private readonly openSignal = signal(false);
  private readonly modeSignal = signal<AgentMode>(this.readStoredMode());
  // Set from a 429 ("daily limit reached") — a verbatim notice that blocks the
  // composer until the budget resets or the user starts a new chat.
  private readonly limitNoticeSignal = signal<string | null>(null);
  // The caller's daily token budget (GET /usage); null until first fetched.
  private readonly usageSignal = signal<AgentUsageResponse | null>(null);

  // History restore (GET /history): paged newest-first, older pages prepended.
  private readonly historyLoadingSignal = signal(false);
  private readonly hasMoreHistorySignal = signal(false);
  // Cursor for the next (older) page; null when nothing older remains.
  private historyCursor: number | null = null;
  // Set once we have restored (or started fresh) so we never refetch and clobber
  // or duplicate the live transcript.
  private historyLoaded = false;

  // Tool toggles (GET/PUT /chat/tools): the role-filtered togglable tools plus
  // the user's saved on/off state. Loaded lazily on first drawer open; saved
  // server-side per user, so sends omit the fields and let the server apply the
  // saved preference (one source of truth).
  private readonly toolsSignal = signal<AgentTool[]>([]);
  private readonly mcpEnabledSignal = signal(true);
  private readonly disabledToolsSignal = signal<string[]>([]);
  private readonly toolsLoadingSignal = signal(false);
  private readonly toolsSavingSignal = signal(false);
  private toolsLoaded = false;

  // Files staged in the composer for the next message (POST /chat/attachments →
  // ids sent on the following /chat). Each carries its own upload status so the
  // chips can show a spinner / error independently.
  private readonly stagedAttachmentsSignal = signal<StagedAttachment[]>([]);

  // Monotonic counter for client-generated ids (user bubbles, approval turns).
  // Avoids crypto.randomUUID(), which only exists in a secure context — it is
  // undefined over plain-HTTP LAN access (e.g. a phone hitting
  // http://<laptop-ip>:4200) and would throw on send.
  private nextMessageId = 0;

  // Aborts the in-flight streaming fetch (sign-out, new chat).
  private abortController?: AbortController;

  readonly messages = this.messagesSignal.asReadonly();
  /** True while a turn is in flight — drives the typing indicator and disables input. */
  readonly sending = this.sendingSignal.asReadonly();
  /** True once the current turn has begun streaming tokens (typing dots → text). */
  readonly streaming = computed(() => this.streamingIdSignal() !== null);
  readonly isOpen = this.openSignal.asReadonly();
  /** Approval mode applied to the next message (ask | agent | auto). */
  readonly mode = this.modeSignal.asReadonly();
  /** Verbatim "limit reached" message when the daily quota is hit, else null. */
  readonly limitNotice = this.limitNoticeSignal.asReadonly();
  /** Daily token budget (used / limit / remaining / resetsAt), or null. */
  readonly usage = this.usageSignal.asReadonly();
  /** True while a history page is loading — drives the "Load earlier" spinner. */
  readonly historyLoading = this.historyLoadingSignal.asReadonly();
  /** True when older history pages remain to load. */
  readonly hasMoreHistory = this.hasMoreHistorySignal.asReadonly();

  /** The tools this user's role may toggle (already role-filtered by the backend). */
  readonly tools = this.toolsSignal.asReadonly();
  /** Master switch: when false the assistant is offered no tools at all. */
  readonly mcpEnabled = this.mcpEnabledSignal.asReadonly();
  /** `name`s of tools the user has switched off (hidden from the model). */
  readonly disabledTools = this.disabledToolsSignal.asReadonly();
  /** True while the tool list is first loading — drives the panel spinner. */
  readonly toolsLoading = this.toolsLoadingSignal.asReadonly();
  /** True while a toggle change is being persisted (PUT in flight). */
  readonly toolsSaving = this.toolsSavingSignal.asReadonly();

  /** Files staged in the composer for the next message (uploading / ready / error). */
  readonly stagedAttachments = this.stagedAttachmentsSignal.asReadonly();
  /** True while any staged file is still uploading — blocks send until it resolves. */
  readonly attachmentsUploading = computed(() =>
    this.stagedAttachmentsSignal().some((a) => a.status === 'uploading'),
  );
  /** How many more files may be attached to the next message (0–2). */
  readonly attachmentSlotsLeft = computed(
    () => MAX_ATTACHMENTS - this.stagedAttachmentsSignal().length,
  );

  /** The assistant is available to every signed-in role except DISTRIBUTOR. */
  readonly available = computed(
    () => this.auth.isAuthenticated() && !this.auth.hasRole(UserRole.DISTRIBUTOR),
  );

  constructor() {
    // Per-user transcript: drop everything on sign-out so the next user starts clean.
    // resetLocal() runs untracked: it reads the very signals it resets (messages,
    // staged attachments, …), and tracking those would make the effect re-dirty
    // itself on each fresh [] it writes — an infinite flush loop that froze the
    // whole app on every logged-out boot.
    effect(() => {
      if (!this.auth.isAuthenticated()) untracked(() => this.resetLocal());
    });
  }

  open(): void {
    this.setOpen(true);
  }

  setOpen(open: boolean): void {
    this.openSignal.set(open);
    // Lazily restore the conversation and load the tool toggles the first time
    // the drawer is opened.
    if (open) {
      this.ensureHistoryLoaded();
      this.ensureToolsLoaded();
    }
  }

  toggle(): void {
    this.setOpen(!this.openSignal());
  }

  setMode(mode: AgentMode): void {
    this.modeSignal.set(mode);
    this.storage.setString(STORAGE_KEYS.AI_AGENT_MODE, mode);
  }

  /** Post one turn. Pushes the user bubble immediately, then streams the reply. */
  send(text: string): void {
    const message = text.trim();
    if (message.length > MAX_MESSAGE_LENGTH || this.sendingSignal() || this.limitNoticeSignal()) {
      return;
    }
    // Never send mid-upload — the attachment id isn't ready yet.
    if (this.attachmentsUploading()) return;

    const ready = this.stagedAttachmentsSignal().filter((a) => a.status === 'ready');
    // A message needs text or at least one attachment (attachment-only is allowed).
    if (!message && ready.length === 0) return;

    // A live turn supersedes any restore — never re-seed over these messages.
    this.historyLoaded = true;

    const attachmentIds = ready
      .map((a) => a.attachmentId)
      .filter((id): id is string => id !== null);
    const attachments: ChatAttachment[] = ready.map((a) => ({
      kind: a.kind,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      previewUrl: a.previewUrl,
      url: a.url,
    }));

    this.append({
      role: 'user',
      text: message,
      attachments: attachments.length ? attachments : undefined,
    });
    // Ownership of the object URLs moves to the bubble — clear staging WITHOUT
    // revoking, so the sent previews stay visible.
    this.stagedAttachmentsSignal.set([]);

    const body: AgentChatRequest = { message, mode: this.modeSignal() };
    if (attachmentIds.length) body.attachmentIds = attachmentIds;
    void this.streamTurn(this.streamUrl, body);
  }

  // --- Attachments ------------------------------------------------------------

  /**
   * Stage image/PDF files for the next message: validate each client-side (type,
   * per-file size, the 2-file cap), then upload it to POST /chat/attachments. Each
   * file gets its own chip with an independent upload status. Rejected files raise
   * a toast and are skipped.
   */
  addFiles(files: File[]): void {
    let slots = this.attachmentSlotsLeft();
    for (const file of files) {
      if (slots <= 0) {
        this.toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      const kind = this.attachmentKind(file);
      if (!kind) {
        this.toast.error(`${file.name}: unsupported file type. Attach an image or a PDF.`);
        continue;
      }
      const cap = kind === 'pdf' ? PDF_MAX_BYTES : IMAGE_MAX_BYTES;
      if (file.size > cap) {
        this.toast.error(
          kind === 'pdf'
            ? `${file.name}: PDFs must be 1 MB or smaller.`
            : `${file.name}: images must be 2 MB or smaller.`,
        );
        continue;
      }

      const localId = this.newId();
      this.stagedAttachmentsSignal.update((list) => [
        ...list,
        {
          localId,
          filename: file.name,
          kind,
          sizeBytes: file.size,
          previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
          status: 'uploading',
          attachmentId: null,
          url: null,
          error: null,
        },
      ]);
      slots--;
      this.uploadAttachment(localId, file);
    }
  }

  /**
   * Flag a sent/restored attachment whose presigned URL failed to load (expired
   * ~1h, or the file's 30-day lifecycle lapsed / chat cleared) so the bubble can
   * swap the image for an "unavailable" placeholder.
   */
  markAttachmentBroken(messageId: string, index: number): void {
    this.messagesSignal.update((list) =>
      list.map((m) =>
        m.id === messageId && m.attachments
          ? {
              ...m,
              attachments: m.attachments.map((a, i) => (i === index ? { ...a, broken: true } : a)),
            }
          : m,
      ),
    );
  }

  /** Drop a staged file (removed by the user, or a failed upload) and free its preview. */
  removeAttachment(localId: string): void {
    const entry = this.stagedAttachmentsSignal().find((a) => a.localId === localId);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    this.stagedAttachmentsSignal.update((list) => list.filter((a) => a.localId !== localId));
  }

  private uploadAttachment(localId: string, file: File): void {
    const form = new FormData();
    // Field name is `files` (repeatable) per the backend; the browser sets the
    // multipart boundary — we must NOT set Content-Type ourselves.
    form.append('files', file, file.name);

    this.http
      .post<AgentAttachmentsResponse>(this.attachmentsUrl, form, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          const uploaded = res.attachments?.[0];
          if (!uploaded) {
            this.patchStaged(localId, { status: 'error', error: 'Upload failed. Please retry.' });
            return;
          }
          this.patchStaged(localId, {
            status: 'ready',
            attachmentId: uploaded.attachmentId,
            url: uploaded.url,
          });
        },
        error: (error) => {
          this.patchStaged(localId, { status: 'error', error: this.attachmentError(error) });
        },
      });
  }

  private patchStaged(localId: string, patch: Partial<StagedAttachment>): void {
    this.stagedAttachmentsSignal.update((list) =>
      list.map((a) => (a.localId === localId ? { ...a, ...patch } : a)),
    );
  }

  private attachmentKind(file: File): AgentAttachmentKind | null {
    if (file.type === 'application/pdf') return 'pdf';
    if (IMAGE_MIME_TYPES.includes(file.type)) return 'image';
    return null;
  }

  // FastAPI returns `{ detail }` (already user-friendly, e.g. an oversized file or
  // an expired id) — surface it verbatim, else fall back to the generic extractor.
  private attachmentError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return this.detailFrom(error.error) ?? this.errorHandler.extract(error).detail;
    }
    return 'Upload failed. Please retry.';
  }

  // The FastAPI error shape: a `{ detail }` string, given either the parsed body
  // or its raw JSON text. Null when no usable detail is present.
  private detailFrom(body: unknown): string | null {
    const source = typeof body === 'string' ? this.parseJson(body) : body;
    const detail =
      source && typeof source === 'object' ? (source as { detail?: unknown }).detail : undefined;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  }

  // Revoke every staged object URL and clear the staging area (new chat / sign-out).
  private clearStagedAttachments(): void {
    for (const a of this.stagedAttachmentsSignal()) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    }
    this.stagedAttachmentsSignal.set([]);
  }

  // Revoke object URLs owned by sent bubbles before the transcript is dropped.
  private revokeMessageAttachments(): void {
    for (const msg of this.messagesSignal()) {
      for (const a of msg.attachments ?? []) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    }
  }

  /**
   * Answer a pending approval round: lock the card with the chosen decisions,
   * then POST /chat/resume/stream to continue the run. `decisions` must hold one
   * entry per pending action, in the order they were returned.
   */
  submitDecisions(messageId: string, decisions: AgentDecision[]): void {
    if (this.sendingSignal()) return;

    this.messagesSignal.update((list) =>
      list.map((msg) => (msg.id === messageId ? { ...msg, decisions } : msg)),
    );

    const body: AgentResumeRequest = { mode: this.modeSignal(), decisions };
    void this.streamTurn(this.resumeStreamUrl, body);
  }

  /**
   * Start a new conversation: clear the server-side chat memory
   * (DELETE /chat/memory), then drop the local transcript and any limit
   * notice. The drawer stays open and the chosen mode is kept. No-op while a
   * turn is in flight (the transcript clears only once the server confirms, so a
   * failed reset never hides messages the server still has context for). The
   * endpoint requires a body, but identity comes from the Bearer token so an
   * empty object is enough.
   */
  resetConversation(): void {
    if (this.sendingSignal()) return;
    this.sendingSignal.set(true);

    this.http
      .delete<void>(this.memoryUrl, { body: {}, context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: () => {
          this.sendingSignal.set(false);
          // Clearing memory also deletes the user's uploaded files server-side.
          this.revokeMessageAttachments();
          this.clearStagedAttachments();
          this.messagesSignal.set([]);
          this.limitNoticeSignal.set(null);
          // Conversation memory is gone — nothing older to restore.
          this.historyCursor = null;
          this.hasMoreHistorySignal.set(false);
          this.historyLoaded = true;
        },
        error: (error) => this.handleError(error),
      });
  }

  /** Load the next older page of history and prepend it above the current view. */
  loadOlderHistory(): void {
    if (
      this.historyLoadingSignal() ||
      !this.hasMoreHistorySignal() ||
      this.historyCursor === null
    ) {
      return;
    }
    this.fetchHistory(this.historyCursor, false);
  }

  // Restore the transcript once, on first open. The in-flight `historyLoading`
  // flag also guards against a concurrent second open.
  private ensureHistoryLoaded(): void {
    if (this.historyLoaded || this.historyLoadingSignal() || !this.available()) return;
    this.refreshUsage();
    this.fetchHistory(null, true);
  }

  private fetchHistory(cursor: number | null, initial: boolean): void {
    this.historyLoadingSignal.set(true);
    // POST with the cursor in the body (omit it for the newest page); identity
    // comes from the Bearer token.
    const body: AgentHistoryRequest = cursor === null ? {} : { cursor };

    this.http
      .post<AgentHistoryResponse>(this.historyUrl, body, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.historyLoadingSignal.set(false);
          const page = res.messages.map((m) => this.fromHistory(m));
          if (initial) {
            this.historyLoaded = true;
            // Drop the page if the user already started a live turn (avoid dups).
            if (this.messagesSignal().length > 0) return;
            this.messagesSignal.set(page);
            // A pause is durable server-side — restore any awaiting approval card
            // below the transcript so a reloaded page looks the same.
            this.restorePending();
          } else {
            this.messagesSignal.update((list) => [...page, ...list]);
          }
          this.historyCursor = res.nextCursor;
          this.hasMoreHistorySignal.set(res.hasMore);
        },
        error: (error) => {
          this.historyLoadingSignal.set(false);
          // History is best-effort — surface it but never block the composer.
          this.errorHandler.showError(error);
        },
      });
  }

  // Reload recovery: GET /chat/pending asks whether a write/question is still
  // awaiting this user's approval and, if so, re-seeds the approval card. Read-only
  // (never charges), best-effort (a failure just skips the restore).
  private restorePending(): void {
    this.http
      .get<AgentPendingResponse>(this.pendingUrl, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          if (res.status !== 'needs_approval' || res.pending.length === 0) return;
          // A live turn may have already produced an undecided card — don't double it.
          if (this.messagesSignal().some((m) => m.pending && !m.decisions)) return;
          this.append({ role: 'assistant', text: '', pending: res.pending });
        },
        error: () => undefined,
      });
  }

  private refreshUsage(): void {
    if (!this.available()) return;
    this.http
      .get<AgentUsageResponse>(this.usageUrl, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => this.usageSignal.set(res),
        // Non-critical: keep the last known budget if this probe fails.
        error: () => undefined,
      });
  }

  /** Flip the master switch (all tools on/off) and persist the new state. */
  setMcpEnabled(enabled: boolean): void {
    if (enabled === this.mcpEnabledSignal()) return;
    this.saveTools(enabled, this.disabledToolsSignal());
  }

  /** Toggle a single tool on/off by `name` and persist the new state. */
  setToolEnabled(name: string, enabled: boolean): void {
    const disabled = new Set(this.disabledToolsSignal());
    // A checked box = tool enabled = absent from disabledTools.
    if (enabled) disabled.delete(name);
    else disabled.add(name);
    this.saveTools(this.mcpEnabledSignal(), [...disabled]);
  }

  // Fetch the togglable tool list + saved state once, on first open. Best-effort:
  // a failure surfaces a toast but never blocks the chat (tools just stay at the
  // backward-compatible default of all-on).
  private ensureToolsLoaded(): void {
    if (this.toolsLoaded || this.toolsLoadingSignal() || !this.available()) return;
    this.toolsLoadingSignal.set(true);
    this.http
      .get<AgentToolSettings>(this.toolsUrl, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.toolsLoaded = true;
          this.toolsLoadingSignal.set(false);
          this.applyToolSettings(res);
        },
        error: (error) => {
          this.toolsLoadingSignal.set(false);
          this.errorHandler.showError(error);
        },
      });
  }

  // PUT the full desired state (a full replace). Optimistic: apply the toggle
  // locally at once for a snappy panel, then reconcile with the echoed response;
  // on failure, show the error and re-pull the server truth so the UI never
  // drifts from what is actually saved.
  private saveTools(mcpEnabled: boolean, disabledTools: string[]): void {
    this.mcpEnabledSignal.set(mcpEnabled);
    this.disabledToolsSignal.set(disabledTools);
    this.toolsSavingSignal.set(true);

    const body: AgentToolSettingsRequest = { mcpEnabled, disabledTools };
    this.http
      .put<AgentToolSettings>(this.toolsUrl, body, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.toolsSavingSignal.set(false);
          this.applyToolSettings(res);
        },
        error: (error) => {
          this.toolsSavingSignal.set(false);
          this.errorHandler.showError(error);
          this.reloadToolSettings();
        },
      });
  }

  // Re-pull the saved state after a failed save so the toggles snap back to the
  // server's truth instead of the optimistic (now-rejected) value.
  private reloadToolSettings(): void {
    this.http
      .get<AgentToolSettings>(this.toolsUrl, { context: this.aiContext() })
      .pipe(timeout(REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => this.applyToolSettings(res),
        error: () => undefined,
      });
  }

  private applyToolSettings(res: AgentToolSettings): void {
    this.toolsSignal.set(res.tools ?? []);
    this.mcpEnabledSignal.set(res.mcpEnabled ?? true);
    this.disabledToolsSignal.set(res.disabledTools ?? []);
  }

  /**
   * Stream one turn (chat or resume) as Server-Sent Events, appending tokens as
   * they arrive. fetch() + ReadableStream (not HttpClient/EventSource): EventSource
   * can't POST or set Authorization, and fetch reads the chunked body unbuffered.
   * The AI service is a separate origin with Bearer-only auth, so we send the token
   * in the header and NO cookies (`credentials: 'omit'`) — that stays within its
   * wildcard CORS.
   */
  private async streamTurn(
    url: string,
    body: AgentChatRequest | AgentResumeRequest,
  ): Promise<void> {
    this.streamingIdSignal.set(null);
    this.sendingSignal.set(true);

    // Refresh-before-send: the browser forwards THIS access token to the MCP server on
    // every tool call, so it must be fresh at send-time — a token near expiry can
    // otherwise lapse mid-run and 401 a tool call halfway. This matters most on the
    // resume (approval) leg, where the user may have sat on the card for minutes. The
    // raw-fetch stream bypasses the HTTP interceptors, so we refresh here explicitly.
    if (!(await this.ensureFreshToken())) return;

    const controller = new AbortController();
    this.abortController = controller;
    // Inactivity guard: abort if neither the initial response nor a chunk arrives
    // within the timeout window; reset the timer on every chunk.
    let idle: ReturnType<typeof setTimeout>;
    const ping = () => {
      clearTimeout(idle);
      idle = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
    };

    try {
      const token = this.auth.getToken();
      ping();
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        await this.handleStreamHttpError(response);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        ping();
        buffer += decoder.decode(value, { stream: true });
        buffer = this.drainSse(buffer, false);
        // A terminal event (done / needs_approval / error) ends the turn — stop
        // reading even if the server keeps the connection open, so the idle timer
        // can't later fire a spurious timeout.
        if (!this.sendingSignal()) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
      // Flush a trailing event that lacked its blank-line terminator.
      this.drainSse(buffer, true);
      // Stream closed without a terminal event — don't leave the spinner on.
      if (this.sendingSignal()) this.finishTurn();
    } catch {
      this.finishTurn();
      const reason = controller.signal.reason;
      if (reason === 'reset') return; // aborted on sign-out / new chat — stay silent
      this.toast.error(
        reason === 'timeout'
          ? 'The assistant took too long to respond. Please try again.'
          : 'The assistant is unavailable right now. Please try again.',
      );
    } finally {
      clearTimeout(idle!);
      if (this.abortController === controller) this.abortController = undefined;
    }
  }

  /**
   * Ensure a fresh access token before a send. Returns true when a usable token is
   * in hand; false when the turn was aborted. `refreshOrInvalidate` owns the session
   * policy: a genuine 401/403 ends the session and routes to login (the sign-out
   * effect then drops this transcript, so no bubble is stranded); a transient
   * failure (network / 5xx / timeout) keeps the session so the user can retry.
   */
  private async ensureFreshToken(): Promise<boolean> {
    if (!this.auth.isTokenExpiringSoon()) return true;
    try {
      await firstValueFrom(this.auth.refreshOrInvalidate().pipe(timeout(REQUEST_TIMEOUT_MS)));
      return true;
    } catch (error) {
      this.finishTurn();
      if (!(error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403))) {
        this.toast.error('The assistant is unavailable right now. Please try again.');
      }
      return false;
    }
  }

  // A non-2xx response (or a missing body) before the stream begins — surface the
  // FastAPI `{ detail }`, treating 429 as the daily-quota block.
  private async handleStreamHttpError(response: Response): Promise<void> {
    this.finishTurn();
    let detail = '';
    try {
      const text = await response.text();
      detail = this.detailFrom(text) ?? text.trim();
    } catch {
      // body not readable — fall back to the status code below
    }
    if (response.status === 429) {
      this.limitNoticeSignal.set(detail || 'Daily limit reached.');
      this.refreshUsage();
      return;
    }
    this.toast.error(detail || `The assistant request failed (${response.status}).`);
  }

  // Dispatch every complete SSE block (blank-line separated) buffered so far and
  // return the unconsumed remainder. When `final`, the trailing remainder is
  // flushed too (a last event that arrived without its terminator). Consecutive
  // `token` events are batched into ONE transcript update per drain — a network
  // chunk often carries many, and per-event updates would clone the message list
  // once per token.
  private drainSse(buffer: string, final: boolean): string {
    const parts = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');
    const remainder = final ? '' : (parts.pop() ?? '');
    let tokens = '';
    for (const block of parts) {
      if (!block.trim()) continue;
      const parsed = this.parseSseBlock(block);
      if (!parsed) continue;
      if (parsed.event === 'token') {
        tokens += typeof parsed.payload?.['text'] === 'string' ? parsed.payload['text'] : '';
        continue;
      }
      // Flush buffered tokens before a terminal event so ordering is preserved.
      this.appendToken(tokens);
      tokens = '';
      this.dispatchSse(parsed.event, parsed.payload);
    }
    this.appendToken(tokens);
    return remainder;
  }

  // One SSE block → its event name + JSON payload; null when it has no data lines.
  private parseSseBlock(
    block: string,
  ): { event: string; payload: Record<string, unknown> | null } | null {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue; // blank line / heartbeat comment
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) return null;
    return { event, payload: this.parseJson(data.join('\n')) };
  }

  private dispatchSse(event: string, payload: Record<string, unknown> | null): void {
    switch (event) {
      case 'needs_approval':
        this.finishWithPending((payload?.['pending'] as AgentPendingAction[]) ?? []);
        break;
      case 'done':
        this.finishWithReply(typeof payload?.['reply'] === 'string' ? payload['reply'] : '');
        break;
      case 'error':
        this.finishWithError(
          (typeof payload?.['detail'] === 'string' && payload['detail'].trim()) ||
            'The assistant stopped unexpectedly. Please try again.',
        );
        break;
      default:
        break; // unknown event — ignore
    }
  }

  private parseJson(data: string): Record<string, unknown> | null {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // Append streamed text: open the assistant bubble on the first token, then
  // grow its text in place as the rest arrive.
  private appendToken(text: string): void {
    if (!text) return;
    const current = this.streamingIdSignal();
    if (current === null) {
      const id = this.newId();
      this.streamingIdSignal.set(id);
      this.messagesSignal.update((list) => [...list, { id, role: 'assistant', text }]);
    } else {
      // The streaming bubble is always the tail — swap it without re-mapping the
      // whole transcript on every chunk.
      this.messagesSignal.update((list) => {
        const tail = list[list.length - 1];
        if (!tail || tail.id !== current) {
          return list.map((m) => (m.id === current ? { ...m, text: m.text + text } : m));
        }
        return [...list.slice(0, -1), { ...tail, text: tail.text + text }];
      });
    }
  }

  private finishWithReply(reply: string): void {
    const id = this.streamingIdSignal();
    if (id === null) {
      // No tokens streamed (e.g. instant short reply) — drop the bubble in now.
      if (reply) this.append({ role: 'assistant', text: reply });
    } else if (reply) {
      // The done event carries the fully assembled reply — adopt it so a dropped
      // token can never leave the bubble truncated.
      this.messagesSignal.update((list) =>
        list.map((m) => (m.id === id ? { ...m, text: reply } : m)),
      );
    }
    this.finishTurn();
    // A turn spent tokens — keep the budget indicator fresh.
    this.refreshUsage();
  }

  private finishWithPending(pending: AgentPendingAction[]): void {
    if (pending.length === 0) {
      // Defensive: needs_approval with no actions — nothing to confirm.
      this.finishTurn();
      return;
    }
    const id = this.streamingIdSignal();
    if (id === null) {
      this.append({ role: 'assistant', text: '', pending });
    } else {
      this.messagesSignal.update((list) => list.map((m) => (m.id === id ? { ...m, pending } : m)));
    }
    this.finishTurn();
    this.refreshUsage();
  }

  private finishWithError(detail: string): void {
    this.finishTurn();
    this.toast.error(detail);
  }

  // Close out the current turn: stop the typing indicator and detach the
  // streaming bubble so the next turn starts a fresh one.
  private finishTurn(): void {
    this.sendingSignal.set(false);
    this.streamingIdSignal.set(null);
  }

  private fromHistory(message: AgentHistoryMessage): ChatMessage {
    const attachments = (message.attachments ?? []).map((a) => this.fromHistoryAttachment(a));
    return {
      id: this.newId(),
      role: message.role,
      // When we render thumbnails, drop the "(attached: …)" fallback line the
      // backend appends to the text so it isn't shown twice.
      text: attachments.length ? this.stripAttachedFallback(message.content) : message.content,
      summary: message.summary || undefined,
      attachments: attachments.length ? attachments : undefined,
    };
  }

  private fromHistoryAttachment(a: AgentHistoryAttachment): ChatAttachment {
    // History has no local blob and no sizeBytes — display straight from the url.
    return { kind: a.kind, filename: a.filename, previewUrl: null, url: a.url };
  }

  // Remove a trailing "_(attached: file.png)_" marker (with any blank lines before
  // it) that the backend adds as a text fallback for clients that can't render.
  private stripAttachedFallback(content: string): string {
    return content.replace(/\n*_\(attached:[^)]*\)_\s*$/, '').trimEnd();
  }

  private handleError(error: unknown): void {
    this.finishTurn();
    // Daily-quota limit: surface the backend message inline and block the
    // composer until the user starts a new chat.
    if (error instanceof HttpErrorResponse && error.status === 429) {
      this.limitNoticeSignal.set(this.limitMessage(error));
      // Pull the budget so the usage meter reflects the exhausted state + reset.
      this.refreshUsage();
      return;
    }
    this.errorHandler.showError(error);
  }

  private limitMessage(error: HttpErrorResponse): string {
    return this.detailFrom(error.error) ?? this.errorHandler.extract(error).detail;
  }

  private readStoredMode(): AgentMode {
    const stored = this.storage.getString(STORAGE_KEYS.AI_AGENT_MODE) as AgentMode | null;
    return stored && AGENT_MODES.includes(stored) ? stored : 'ask';
  }

  private resetLocal(): void {
    // Abort any in-flight stream so a late event can't repopulate the next user.
    this.abortController?.abort('reset');
    this.abortController = undefined;
    this.revokeMessageAttachments();
    this.clearStagedAttachments();
    this.messagesSignal.set([]);
    this.sendingSignal.set(false);
    this.streamingIdSignal.set(null);
    this.openSignal.set(false);
    this.limitNoticeSignal.set(null);
    this.usageSignal.set(null);
    this.historyLoadingSignal.set(false);
    this.hasMoreHistorySignal.set(false);
    this.historyCursor = null;
    // Let the next signed-in user restore their own history afresh.
    this.historyLoaded = false;
    // Tool prefs are per-user server-side — drop them so the next user loads
    // their own on open, and fall back to the all-on default meanwhile.
    this.toolsSignal.set([]);
    this.mcpEnabledSignal.set(true);
    this.disabledToolsSignal.set([]);
    this.toolsLoadingSignal.set(false);
    this.toolsSavingSignal.set(false);
    this.toolsLoaded = false;
  }

  private append(message: Omit<ChatMessage, 'id'>): void {
    this.messagesSignal.update((list) => [...list, { id: this.newId(), ...message }]);
  }

  private newId(): string {
    return `${Date.now()}-${this.nextMessageId++}`;
  }

  // Flags an HttpClient call as bound for the cross-origin AI service: bearer
  // token kept, cookies + CSRF dropped (see AI_REQUEST / authInterceptor).
  private aiContext(): HttpContext {
    return new HttpContext().set(AI_REQUEST, true);
  }
}
