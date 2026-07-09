export type ChatRole = 'user' | 'assistant';

// Approval mode sent per message: ask = always confirm writes, agent = let the
// agent decide, auto = run writes without asking.
export type AgentMode = 'auto' | 'agent' | 'ask';

// What the frontend may send back for a pending action via /resume:
// - approve  → run the action as proposed.
// - edit     → run it with corrected values (carried in `editedAction`) in ONE
//              pass; there is no second approval.
// - reject   → cancel the action; `message` is an optional reason.
// - respond  → answer an `ask_user` question; `message` is the chosen/typed answer.
export type DecisionType = 'approve' | 'edit' | 'reject' | 'respond';

// Status of the write awaiting approval, from GET /chat/pending (reload recovery).
export type AgentPendingStatus = 'needs_approval' | 'idle';

// An attachment is an image or a PDF the user adds to a message for the
// assistant to read/act on (a handwritten list, a bill, a photo of text).
export type AgentAttachmentKind = 'image' | 'pdf';

// One uploaded file, from POST /chat/attachments. `attachmentId` is referenced
// on the next send; `url` is a short-lived presigned GET URL to display it right
// away — the SAME url source /chat/history returns, so composer + transcript
// share one render path.
export interface AgentAttachment {
  attachmentId: string;
  kind: AgentAttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

// POST /chat/attachments response — the ids + metadata for the uploaded files.
export interface AgentAttachmentsResponse {
  attachments: AgentAttachment[];
}

// POST /chat body. `mode` is required (a missing/invalid mode is 422).
// `attachmentIds` (optional) carries files uploaded via POST /chat/attachments;
// attachments ride only a new message — NEVER /chat/resume.
export interface AgentChatRequest {
  message: string;
  mode: AgentMode;
  attachmentIds?: string[];
}

// Per-argument display data for a pending action: a plain-English label and an
// id-free display value (a record name in place of a numeric id). DISPLAY-ONLY —
// an edit submission takes its values from `args`, never from here.
export interface AgentPendingField {
  key: string; // the exact `args` key this describes
  label: string; // plain-English form label
  value: string; // id-free display value (e.g. a record name over a raw id)
}

// A write the agent wants to run — or an `ask_user` question — awaiting the user.
export interface AgentPendingAction {
  id: string; // stable handle for this action within the turn (positional, e.g. action-0)
  name: string; // internal tool name — kept for editedAction.name; never shown raw
  title?: string; // plain header for the card/chip (show this, not `name`)
  summary: string; // markdown summary to display (ignored for ask_user; build from args)
  // Per-arg display meta: labels for the edit form + id-free display values.
  // Ignored for ask_user. Optional — fall back to humanizing the arg key.
  fields?: AgentPendingField[];
  // Proposed tool args (secrets masked as ••••). The source of truth for the edit
  // form's SUBMITTED values (writes) and the disambiguation picker (ask_user carries
  // snake_case question / options / allow_custom). Never echo a masked ••••back.
  args: Record<string, unknown>;
  // Which decision buttons this action offers — the whole rendering switch:
  // a write carries approve/edit/reject; an ask_user question carries respond/reject.
  actions: DecisionType[];
}

// The user's corrected tool call for an `edit` decision: the SAME tool, new args.
// `args` must keep the exact structure the tool expects — including any
// { request: { … } } wrapper — because the tool runs directly with these values.
// Masked (••••) secret fields are omitted so real values are not overwritten.
export interface AgentEditedAction {
  name: string; // same as the reviewed action's name
  args: Record<string, unknown>; // corrected args, in the tool's original structure
}

// One decision per pending action, in the order they were returned.
// - approve  → no extra fields.
// - edit     → `editedAction` with corrected args (no `message`).
// - reject   → optional `message` reason.
// - respond  → `message` is the chosen/typed answer to an `ask_user` question.
export interface AgentDecision {
  type: DecisionType;
  message?: string;
  editedAction?: AgentEditedAction;
}

// POST /chat/resume body. `mode` is required here too (a missing/invalid
// mode is 422) — send the mode the conversation is currently in.
export interface AgentResumeRequest {
  mode: AgentMode;
  decisions: AgentDecision[];
}

// GET /chat/pending — the write/question currently awaiting approval, so a
// reloaded page can restore the approval card. Same PendingAction shape as
// /chat; `idle` (pending []) when nothing is paused. Read-only; never charges.
export interface AgentPendingResponse {
  status: AgentPendingStatus;
  pending: AgentPendingAction[];
  threadId?: string;
}

// GET /chat/usage — the caller's daily AI token budget (resets at UTC
// midnight). `limit`/`remaining` are -1 when the role has no cap.
export interface AgentUsageResponse {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string; // ISO-8601 instant
}

// One file on a restored user turn (POST /chat/history). Same shape the upload
// returns — one render path — minus the send-only id and sizeBytes. `url` is the
// short-lived presigned GET URL (may 404 once expired/cleared).
export type AgentHistoryAttachment = Omit<AgentAttachment, 'attachmentId' | 'sizeBytes'>;

// One restorable line from POST /chat/history: a prior turn, or — when
// `summary` is true — a marker where earlier turns were summarized (a divider).
// `attachments` are the files on a user turn (assistant turns get []); the
// "(attached: …)" text in `content` is a plain fallback, hidden when we show them.
export interface AgentHistoryMessage {
  role: ChatRole;
  content: string; // markdown
  summary: boolean;
  attachments?: AgentHistoryAttachment[];
}

// POST /chat/history body. Omit `cursor` for the newest page; pass the
// previous page's `nextCursor` to walk older. Identity comes from the Bearer
// token, so no user id is sent.
export interface AgentHistoryRequest {
  cursor?: number | null;
}

// POST /chat/history page. `messages` are oldest-first within the page and
// are prepended above what is already shown; pass `nextCursor` back as `cursor`
// to load the previous (older) page until `hasMore` is false.
export interface AgentHistoryResponse {
  messages: AgentHistoryMessage[];
  nextCursor: number | null;
  hasMore: boolean;
}

// One tool the assistant may be offered, from GET /chat/tools. The list is
// already role-filtered by the backend; an internal disambiguation tool
// (`ask_user`) is intentionally never included and never affected by toggles.
export interface AgentTool {
  name: string; // internal identifier — sent back in `disabledTools` to hide it
  label: string; // plain-English display text for the toggle
}

// GET /chat/tools + PUT /chat/tools response — the togglable tools plus the
// user's saved on/off state. A token-saving DISPLAY control only: it changes
// what the model is *offered*, never permissions (the backend still enforces
// real role access on every call). `mcpEnabled` is the master switch (false =
// no tool schema sent at all → pure chat); `disabledTools` lists hidden `name`s.
export interface AgentToolSettings {
  tools: AgentTool[];
  mcpEnabled: boolean;
  disabledTools: string[];
}

// PUT /chat/tools body — a FULL replace of the saved state (send the complete
// desired state). Both fields are optional server-side, but we always send both
// to avoid surprises. The response echoes AgentToolSettings.
export interface AgentToolSettingsRequest {
  mcpEnabled: boolean;
  disabledTools: string[];
}

// An attachment as shown on a user bubble (display-only). Two src sources feed
// one render path: `previewUrl` is a local object URL (instant paint, images
// only, live sends) and `url` is the durable presigned URL (from upload +
// history). Prefer the blob when present, else the url. `broken` flips when the
// url 404s (expired / cleared) so the UI can show an "unavailable" placeholder.
export interface ChatAttachment {
  kind: AgentAttachmentKind;
  filename: string;
  sizeBytes?: number; // absent on history-restored attachments
  previewUrl: string | null; // object URL for live-sent images; null otherwise
  url: string | null; // presigned URL; null if never uploaded
  broken?: boolean;
}

// A file staged in the composer before/while it uploads. Starts `uploading`,
// becomes `ready` (with an `attachmentId` to send) or `error` (with a reason).
export interface StagedAttachment {
  localId: string; // client handle for patch/remove before the id exists
  filename: string;
  kind: AgentAttachmentKind;
  sizeBytes: number;
  previewUrl: string | null; // object URL for images; null for PDFs
  status: 'uploading' | 'ready' | 'error';
  attachmentId: string | null; // set once the upload resolves
  url: string | null; // presigned URL, set once the upload resolves
  error: string | null;
}

// One bubble in the local transcript. An assistant turn that pauses for approval
// carries `pending`; once the user answers, `decisions` is stamped on to lock it.
// `summary` marks a restored "earlier turns summarized" divider (no bubble).
// `attachments` are the files the user sent with the message (user bubbles only).
export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string; // markdown reply (assistant) or raw text (user)
  pending?: AgentPendingAction[];
  decisions?: AgentDecision[];
  summary?: boolean;
  attachments?: ChatAttachment[];
}
