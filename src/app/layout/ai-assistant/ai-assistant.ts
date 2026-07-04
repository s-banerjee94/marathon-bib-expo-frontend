import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { PopoverModule } from 'primeng/popover';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { LayoutService } from '../../core/services/layout.service';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import { LabelizePipe } from '../../shared/pipes/labelize-pipe';
import {
  AgentDecision,
  AgentMode,
  AgentPendingAction,
  AgentPendingField,
  ChatAttachment,
  ChatMessage,
  DecisionType,
} from '../../core/models/ai-assistant.model';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { ImageModule } from 'primeng/image';
import { ProgressBarModule } from 'primeng/progressbar';

const FAB_SIZE = 56;
const POPUP_WIDTH = 352;
const POPUP_HEIGHT = 560;
const EDGE_GAP = 16;
// Movement under this many px counts as a click (toggle) rather than a drag.
const DRAG_THRESHOLD = 5;
// Auto-follow streaming text only when the user is within this many px of the
// bottom — so reading older messages mid-stream isn't yanked away.
const STICK_BOTTOM_PX = 80;

// One editable field in an auto-generated edit form (writes). Values are edited
// as strings/booleans and coerced back to their original type on submit.
interface EditField {
  key: string; // the tool's own arg key — echoed back exactly
  label: string; // humanized key, display only
  original: unknown; // original value (kept for read-only/complex fields)
  readonly: boolean; // *Id identifiers and nested objects — not editable
  masked: boolean; // came as ••••; blank input, omitted unless the user types
  kind: 'text' | 'number' | 'boolean';
  value: string; // text/number editing buffer
  boolValue: boolean; // boolean editing buffer
  display: string; // read-only display text
}

// Per-action editable choice for the active approval round. Depending on the
// chosen `type` it carries: a reject reason (`note`), the edit form (`fields`),
// or the ask_user answer (`selectedOption` / `customText`). On a single-action
// card the chosen `type` also drives which inline editor is expanded.
interface DecisionDraft {
  type: DecisionType;
  note: string; // reject reason (optional)
  // edit (writes)
  wrapperKey: string | null; // the { request: {…} } wrapper key, if any
  fields: EditField[];
  // respond (ask_user)
  options: string[];
  allowCustom: boolean;
  selectedOption: string | null;
  customText: string;
  respondError?: string;
}

@Component({
  selector: 'app-ai-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ButtonModule,
    TextareaModule,
    InputTextModule,
    RadioButtonModule,
    ToggleSwitchModule,
    CheckboxModule,
    DialogModule,
    ImageModule,
    ProgressBarModule,
    PopoverModule,
    TagModule,
    MessageModule,
    TooltipModule,
    MarkdownPipe,
  ],
  templateUrl: './ai-assistant.html',
})
export class AiAssistant {
  protected readonly assistant = inject(AiAssistantService);
  protected readonly layout = inject(LayoutService);
  // Shared key → "Title Case" labelizer (acronym-aware), used programmatically
  // for edit-form field labels and the action-title fallback.
  private readonly labelize = new LabelizePipe();

  protected readonly draft = signal('');

  // Hidden native file input, opened by the paperclip button.
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly acceptTypes = this.assistant.acceptTypes;

  // Drag-and-drop onto the panel (Claude/ChatGPT-style). A depth counter keeps
  // the overlay steady while the cursor crosses child elements.
  protected readonly dragActive = signal(false);
  private dragDepth = 0;

  // Mode picker (composer button → popover).
  protected readonly modeOptions: {
    value: AgentMode;
    label: string;
    icon: string;
    hint: string;
  }[] = [
    { value: 'ask', label: 'Ask', icon: 'pi pi-check-square', hint: 'Always confirm writes' },
    { value: 'agent', label: 'Agent', icon: 'pi pi-sparkles', hint: 'Let the agent decide' },
    { value: 'auto', label: 'Auto', icon: 'pi pi-bolt', hint: 'Run writes without asking' },
  ];
  protected readonly currentMode = computed(
    () => this.modeOptions.find((m) => m.value === this.assistant.mode()) ?? this.modeOptions[0],
  );

  // Daily token budget meter — shown only when the caller's role has a cap
  // (limit > 0; -1 means unlimited, so we hide it entirely).
  protected readonly showUsage = computed(() => {
    const usage = this.assistant.usage();
    return !!usage && usage.limit > 0;
  });
  protected readonly usagePercent = computed(() => {
    const usage = this.assistant.usage();
    if (!usage || usage.limit <= 0) return 0;
    return Math.min(100, Math.round((usage.used / usage.limit) * 100));
  });
  protected readonly usageResetLabel = computed(() => {
    const usage = this.assistant.usage();
    if (!usage) return '';
    const ms = new Date(usage.resetsAt).getTime() - Date.now();
    if (ms <= 0) return 'now';
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  });
  protected readonly usageTooltip = computed(() => {
    const usage = this.assistant.usage();
    if (!usage) return '';
    return `${this.formatTokens(usage.used)} of ${this.formatTokens(usage.limit)} daily tokens used · resets in ${this.usageResetLabel()}`;
  });

  // --- Tool toggles (master switch + per-tool checkboxes) ---------------------

  // Fast membership lookup for "is this tool switched off?".
  private readonly disabledToolSet = computed(() => new Set(this.assistant.disabledTools()));
  // How many role-available tools are currently on — drives the panel count.
  protected readonly activeToolCount = computed(
    () => this.assistant.tools().filter((t) => !this.disabledToolSet().has(t.name)).length,
  );

  // Live filter over the tool list (by label or internal name); the count stays
  // a global summary, only the rendered rows are filtered.
  protected readonly toolSearch = signal('');
  protected readonly filteredTools = computed(() => {
    const query = this.toolSearch().trim().toLowerCase();
    const tools = this.assistant.tools();
    if (!query) return tools;
    return tools.filter(
      (t) => t.label.toLowerCase().includes(query) || t.name.toLowerCase().includes(query),
    );
  });
  // Only surface the search box once the list is long enough to warrant it.
  protected readonly showToolSearch = computed(() => this.assistant.tools().length > 6);
  // Tools panel is a modal dialog (not a popover) — no trigger anchoring, so it
  // can't drift on scroll and always centers in view across all display modes.
  protected readonly toolsDialogOpen = signal(false);

  protected isToolEnabled(name: string): boolean {
    return !this.disabledToolSet().has(name);
  }

  // Decision picker order (each rendered only when the action allows it).
  protected readonly allDecisionTypes: DecisionType[] = ['approve', 'edit', 'respond', 'reject'];

  // Everything the UI derives from a decision type: picker/resolved labels and
  // icons, the PrimeNG button severity, and the accent color (green go, neutral
  // tweak, high-contrast answer, red stop).
  protected readonly decisionMeta: Record<
    DecisionType,
    {
      label: string;
      icon: string;
      past: string;
      severity: 'success' | 'secondary' | 'contrast' | 'danger';
      color: string;
    }
  > = {
    approve: {
      label: 'Approve',
      icon: 'pi pi-check',
      past: 'Approved',
      severity: 'success',
      color: 'var(--p-green-500)',
    },
    edit: {
      label: 'Edit',
      icon: 'pi pi-pencil',
      past: 'Edited',
      severity: 'secondary',
      color: 'var(--p-blue-500)',
    },
    respond: {
      label: 'Answer',
      icon: 'pi pi-reply',
      past: 'Answered',
      severity: 'contrast',
      color: 'var(--p-blue-500)',
    },
    reject: {
      label: 'Reject',
      icon: 'pi pi-times',
      past: 'Rejected',
      severity: 'danger',
      color: 'var(--p-red-500)',
    },
  };

  // The latest assistant turn that is paused for approval (none if all resolved).
  protected readonly activePending = computed<ChatMessage | undefined>(() => {
    const list = this.assistant.messages();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].pending && !list[i].decisions) return list[i];
    }
    return undefined;
  });

  // Editable decisions for the active round (one per pending action, in order),
  // re-seeded automatically whenever a new approval round arrives.
  protected readonly decisionDrafts = linkedSignal<DecisionDraft[]>(() =>
    (this.activePending()?.pending ?? []).map((action) => this.initDraft(action)),
  );

  // A lone pending action gets the direct-action flow (Approve submits in one
  // click); a multi-action round falls back to decide-each + one batched submit.
  protected readonly isSingleRound = computed(
    () => (this.activePending()?.pending?.length ?? 0) === 1,
  );

  protected readonly composerDisabled = computed(
    () => this.assistant.sending() || !!this.activePending() || !!this.assistant.limitNotice(),
  );

  protected readonly readyAttachmentCount = computed(
    () => this.assistant.stagedAttachments().filter((a) => a.status === 'ready').length,
  );

  // Send is allowed with text OR at least one uploaded attachment, but never
  // mid-upload or while the composer is otherwise blocked (sending / pending / limit).
  protected readonly canSend = computed(() => {
    if (this.composerDisabled() || this.assistant.attachmentsUploading()) return false;
    return this.draft().trim().length > 0 || this.readyAttachmentCount() > 0;
  });

  // A lone ask_user question submits as "Answer"; anything else as "Send decisions".
  protected readonly submitLabel = computed(() => {
    const pending = this.activePending()?.pending;
    return pending?.length === 1 && this.isQuestion(pending[0]) ? 'Answer' : 'Send decisions';
  });

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

  // Tail tracking so we only auto-scroll on new messages / typing, not when an
  // older history page is prepended (which would yank the view to the bottom).
  private lastTailId: string | null = null;
  private wasSending = false;
  // Whether the user sits within STICK_BOTTOM_PX of the bottom — maintained by a
  // passive scroll listener so streaming growth never forces a layout to find out.
  private nearBottom = true;
  // Pre-prepend metrics, captured on "Load earlier" to hold the scroll anchor.
  private scrollRestore: { top: number; height: number } | null = null;

  private dragging = false;
  private moved = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private fabStartX = 0;
  private fabStartY = 0;

  constructor() {
    // Track distance-from-bottom from scroll events (passive, outside change
    // detection) so streaming growth only pulls the view down when the user is
    // already near the bottom — without forcing a layout on every chunk.
    effect((onCleanup) => {
      const el = this.scrollArea()?.nativeElement;
      if (!el) return;
      const measure = () => {
        this.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_BOTTOM_PX;
      };
      el.addEventListener('scroll', measure, { passive: true });
      onCleanup(() => el.removeEventListener('scroll', measure));
    });

    // Keep the transcript pinned to the newest message / typing indicator and to
    // streaming token growth, but hold position when an older history page is
    // prepended above the view (or the user has scrolled up to read).
    effect(() => {
      const messages = this.assistant.messages();
      const sending = this.assistant.sending();
      const tailId = messages.length ? messages[messages.length - 1].id : null;
      const newTail = tailId !== this.lastTailId;
      const sendingRose = sending && !this.wasSending;
      this.lastTailId = tailId;
      this.wasSending = sending;
      setTimeout(() => this.applyScroll(newTail || sendingRose || (sending && this.nearBottom)));
    });
  }

  protected onSend(): void {
    if (!this.canSend()) return;
    this.assistant.send(this.draft());
    this.draft.set('');
  }

  protected onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    this.onSend();
  }

  // --- Attachments ------------------------------------------------------------

  protected openFilePicker(): void {
    if (this.composerDisabled() || this.assistant.attachmentSlotsLeft() <= 0) return;
    this.fileInput()?.nativeElement.click();
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length) this.assistant.addFiles(files);
    // Reset so re-picking the same file fires `change` again.
    input.value = '';
  }

  // A sent/restored attachment's presigned URL failed to load (expired/cleared) —
  // flag it so the bubble shows an "unavailable" placeholder. `msgId` is absent for
  // staged (blob) chips, which never error.
  protected onAttachmentError(msgId: string | null, index: number): void {
    if (msgId) this.assistant.markAttachmentBroken(msgId, index);
  }

  // Open a PDF (or any attachment with a durable URL) in a new tab to view it.
  protected openAttachment(att: ChatAttachment): void {
    if (att.url && !att.broken) window.open(att.url, '_blank', 'noopener');
  }

  protected onDragEnter(event: DragEvent): void {
    if (this.composerDisabled() || !this.hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragActive.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.composerDisabled() || !this.hasFiles(event)) return;
    // Required so the drop event fires.
    event.preventDefault();
  }

  protected onDragLeave(): void {
    if (this.dragDepth === 0) return;
    this.dragDepth--;
    if (this.dragDepth === 0) this.dragActive.set(false);
  }

  protected onDrop(event: DragEvent): void {
    const hadFiles = this.hasFiles(event);
    this.dragDepth = 0;
    this.dragActive.set(false);
    if (this.composerDisabled() || !hadFiles) return;
    event.preventDefault();
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    if (files.length) this.assistant.addFiles(files);
  }

  private hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // Load the previous (older) history page, anchoring the scroll so the first
  // currently-visible message stays put after the prepend.
  protected onLoadEarlier(): void {
    const el = this.scrollArea()?.nativeElement;
    this.scrollRestore = el ? { top: el.scrollTop, height: el.scrollHeight } : null;
    this.assistant.loadOlderHistory();
  }

  protected formatTokens(value: number): string {
    if (value < 1000) return `${value}`;
    const thousands = value / 1000;
    return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
  }

  // --- Approval round ---------------------------------------------------------

  protected isAllowed(action: AgentPendingAction, type: DecisionType): boolean {
    return action.actions.includes(type);
  }

  // An ask_user question (render the picker); otherwise a write (render the form).
  protected isQuestion(action: AgentPendingAction): boolean {
    return action.actions.includes('respond');
  }

  // The ask_user prompt, read straight from args so it shows on decided cards too.
  protected questionText(action: AgentPendingAction): string {
    const question = action.args['question'];
    return typeof question === 'string' ? question : '';
  }

  // "Cancel" reads better than "Reject" on an ask_user question.
  protected decisionLabel(action: AgentPendingAction, type: DecisionType): string {
    if (type === 'reject' && this.isQuestion(action)) return 'Cancel';
    return this.decisionMeta[type].label;
  }

  protected setDecisionType(index: number, type: DecisionType): void {
    this.patchDraft(index, { type, respondError: undefined });
  }

  protected setNote(index: number, note: string): void {
    this.patchDraft(index, { note });
  }

  protected setFieldValue(actionIndex: number, fieldIndex: number, value: string): void {
    this.patchField(actionIndex, fieldIndex, { value });
  }

  protected setFieldBool(actionIndex: number, fieldIndex: number, boolValue: boolean): void {
    this.patchField(actionIndex, fieldIndex, { boolValue });
  }

  protected setSelectedOption(index: number, option: string): void {
    this.patchDraft(index, { selectedOption: option, respondError: undefined });
  }

  protected setCustomText(index: number, customText: string): void {
    this.patchDraft(index, { customText, respondError: undefined });
  }

  // --- Single-action direct flow ----------------------------------------------
  // A lone pending action commits in one gesture: Approve fires immediately;
  // Edit / Reject expand an inline editor (driven by the draft's `type`) whose
  // own button commits via sendDecisions().

  // Approve (or Confirm, for a destructive tool) — submit the single decision now.
  protected chooseApprove(index: number): void {
    this.patchDraft(index, { type: 'approve' });
    this.sendDecisions();
  }

  // Expand the edit form or the reject note for the single-action card.
  protected openEditor(index: number, view: 'edit' | 'reject'): void {
    this.patchDraft(index, { type: view });
  }

  // Back out to the three-button choose state without submitting.
  protected closeEditor(index: number): void {
    this.patchDraft(index, { type: 'approve' });
  }

  // Cancel an ask_user question — reject it with no message.
  protected cancelQuestion(index: number): void {
    this.patchDraft(index, { type: 'reject', note: '' });
    this.sendDecisions();
  }

  // --- Card presentation ------------------------------------------------------

  // The backend's plain header (never the raw tool name); labelize as a fallback.
  protected actionTitle(action: AgentPendingAction): string {
    return action.title?.trim() || this.labelize.transform(action.name);
  }

  // A verb-matched icon derived from the tool name prefix.
  protected actionIcon(action: AgentPendingAction): string {
    const name = action.name.toLowerCase();
    if (name.startsWith('delete') || name.startsWith('remove')) return 'pi pi-trash';
    if (name.startsWith('invite')) return 'pi pi-user-plus';
    if (name.startsWith('create') || name.startsWith('add')) return 'pi pi-plus';
    if (name.startsWith('send') || name.includes('campaign') || name.includes('sms')) {
      return 'pi pi-send';
    }
    if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('change')) {
      return 'pi pi-pencil';
    }
    return 'pi pi-bolt';
  }

  // Destructive writes get the danger accent (red edge, red confirm button).
  protected isDestructive(action: AgentPendingAction): boolean {
    const name = action.name.toLowerCase();
    return name.includes('delete') || name.startsWith('remove');
  }

  protected approveLabel(action: AgentPendingAction): string {
    return this.isDestructive(action) ? 'Confirm' : 'Approve';
  }

  // Past-tense label on the resolved chip (a cancelled question reads better).
  protected resolvedLabel(action: AgentPendingAction, decision: AgentDecision): string {
    if (decision.type === 'reject' && this.isQuestion(action)) return 'Cancelled';
    return this.decisionMeta[decision.type].past;
  }

  protected hasReadonly(draft: DecisionDraft): boolean {
    return draft.fields.some((f) => f.readonly);
  }

  protected sendDecisions(): void {
    const msg = this.activePending();
    if (!msg || this.assistant.sending()) return;

    const actions = msg.pending ?? [];
    const validated = this.decisionDrafts().map((d, i) => this.validateDraft(d, actions[i]));
    if (validated.some((v) => !v.ok)) {
      this.decisionDrafts.set(validated.map((v) => v.draft));
      return;
    }
    this.assistant.submitDecisions(
      msg.id,
      validated.map((v) => v.decision as AgentDecision),
    );
  }

  private patchDraft(index: number, patch: Partial<DecisionDraft>): void {
    this.decisionDrafts.update((drafts) =>
      drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  private patchField(actionIndex: number, fieldIndex: number, patch: Partial<EditField>): void {
    this.decisionDrafts.update((drafts) =>
      drafts.map((d, i) =>
        i === actionIndex
          ? { ...d, fields: d.fields.map((f, j) => (j === fieldIndex ? { ...f, ...patch } : f)) }
          : d,
      ),
    );
  }

  private initDraft(action: AgentPendingAction): DecisionDraft {
    const base: DecisionDraft = {
      type: 'approve',
      note: '',
      wrapperKey: null,
      fields: [],
      options: [],
      allowCustom: false,
      selectedOption: null,
      customText: '',
    };

    // ask_user → a picker built from the tool's snake_case args (ignore summary).
    if (this.isQuestion(action)) {
      const { options, allowCustom } = this.parseQuestion(action.args);
      return {
        ...base,
        type: 'respond',
        options,
        allowCustom,
        selectedOption: options[0] ?? null,
      };
    }

    // write → default to approve; the edit form is generated lazily from args,
    // labelled from the backend's field meta.
    const { wrapperKey, fields } = this.buildFields(action.args, action.fields ?? []);
    const type: DecisionType = action.actions.includes('approve')
      ? 'approve'
      : (action.actions[0] ?? 'approve');
    return { ...base, type, wrapperKey, fields };
  }

  private validateDraft(
    draft: DecisionDraft,
    action: AgentPendingAction,
  ): { ok: boolean; draft: DecisionDraft; decision?: AgentDecision } {
    switch (draft.type) {
      case 'approve':
        return { ok: true, draft, decision: { type: 'approve' } };
      case 'reject':
        return {
          ok: true,
          draft,
          decision: { type: 'reject', message: draft.note.trim() || undefined },
        };
      case 'edit':
        return {
          ok: true,
          draft,
          decision: {
            type: 'edit',
            editedAction: { name: action.name, args: this.buildEditedArgs(draft) },
          },
        };
      case 'respond': {
        const answer = draft.customText.trim() || (draft.selectedOption ?? '').trim();
        if (!answer) {
          return {
            ok: false,
            draft: { ...draft, respondError: 'Pick an option or type an answer.' },
          };
        }
        return { ok: true, draft, decision: { type: 'respond', message: answer } };
      }
    }
  }

  // --- Edit form (writes): flatten args → fields, then rebuild the same shape ---

  private buildFields(
    args: Record<string, unknown>,
    fieldMeta: AgentPendingField[],
  ): {
    wrapperKey: string | null;
    fields: EditField[];
  } {
    const meta = new Map(fieldMeta.map((f) => [f.key, f]));
    const keys = Object.keys(args);
    // Create/update tools usually wrap their payload as { request: {…} } — edit the
    // inner fields and re-wrap on submit so the tool's structure is preserved.
    if (keys.length === 1 && this.isPlainObject(args[keys[0]])) {
      const inner = args[keys[0]] as Record<string, unknown>;
      return {
        wrapperKey: keys[0],
        fields: Object.entries(inner).map(([k, v]) => this.toField(k, v, meta.get(k))),
      };
    }
    return {
      wrapperKey: null,
      fields: Object.entries(args).map(([k, v]) => this.toField(k, v, meta.get(k))),
    };
  }

  private toField(key: string, value: unknown, meta?: AgentPendingField): EditField {
    const complex = this.isPlainObject(value) || Array.isArray(value);
    const masked = typeof value === 'string' && /•/.test(value);
    const readonly = this.isIdentifier(key) || complex;
    const kind: EditField['kind'] =
      typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text';
    return {
      key,
      // Plain-English label from the backend's field meta; labelize as a fallback.
      label: meta?.label ?? this.labelize.transform(key),
      original: value,
      readonly,
      masked,
      kind,
      value: masked || kind === 'boolean' ? '' : this.toText(value),
      boolValue: value === true,
      // Prefer the backend's id-free display value (a record name over a raw id).
      display: meta?.value ?? (complex ? JSON.stringify(value) : this.toText(value)),
    };
  }

  // Rebuild the tool's args from the edited fields, preserving structure and value
  // types. Read-only fields keep their original value; a masked field left blank is
  // omitted so the real secret is not overwritten with ••••.
  private buildEditedArgs(draft: DecisionDraft): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const f of draft.fields) {
      if (f.readonly) {
        obj[f.key] = f.original;
        continue;
      }
      if (f.kind === 'boolean') {
        obj[f.key] = f.boolValue;
        continue;
      }
      if (f.masked && !f.value.trim()) continue;
      if (f.kind === 'number') {
        const text = f.value.trim();
        if (text === '') {
          obj[f.key] = null;
          continue;
        }
        const num = Number(text);
        obj[f.key] = Number.isNaN(num) ? f.value : num;
        continue;
      }
      obj[f.key] = f.value;
    }
    return draft.wrapperKey ? { [draft.wrapperKey]: obj } : obj;
  }

  // --- ask_user picker --------------------------------------------------------

  private parseQuestion(args: Record<string, unknown>): {
    options: string[];
    allowCustom: boolean;
  } {
    return {
      options: Array.isArray(args['options']) ? args['options'].map((o) => String(o)) : [],
      allowCustom: args['allow_custom'] === true,
    };
  }

  // --- small helpers ----------------------------------------------------------

  private isIdentifier(key: string): boolean {
    return key === 'id' || /(_id|Id)$/.test(key);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  // --- Popup drag (unchanged) -------------------------------------------------

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

  private applyScroll(toBottom: boolean): void {
    const el = this.scrollArea()?.nativeElement;
    if (!el) return;
    if (this.scrollRestore) {
      // Restore the anchor: keep the previously-top content in the same spot.
      el.scrollTop = el.scrollHeight - this.scrollRestore.height + this.scrollRestore.top;
      this.scrollRestore = null;
    } else if (toBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
