import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { TargetField, Mapping } from '../../../core/models/import-mapper.model';

interface Point {
  x: number;
  y: number;
}

type Side = 'csv' | 'field';

/** Vibrant palette for connector lines (assigned per CSV column, stable). */
const CONNECTOR_PALETTE = [
  '#34d399',
  '#22d3ee',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#2dd4bf',
  '#f87171',
  '#38bdf8',
  '#c084fc',
];

/**
 * Visual drag-to-connect mapper. The left column lists the uploaded CSV headers,
 * the right column lists the participant target fields. Grab anywhere on a card and
 * drag onto a card on the other side to connect; connections are drawn as glowing
 * SVG bezier paths derived purely from {@link connections} state (no canvas).
 *
 * - Single fields hold one connection (a new drop replaces the old one).
 * - Bucket fields (goodies / other) accept many connections fanning in.
 * - Each CSV column participates in at most one connection.
 * - There is no auto-mapping — every connection is made by the user.
 */
@Component({
  selector: 'app-column-mapper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './column-mapper.html',
})
export class ColumnMapper {
  /** CSV column headers from the uploaded file (left side). */
  csvColumns = input.required<string[]>();

  /** Target fields (right side) — fetched per-event plus the fixed buckets. */
  targetFields = input.required<TargetField[]>();

  /** Committed connections — two-way bound so the parent can build the JSON. */
  connections = model<Mapping[]>([]);

  private host = viewChild<ElementRef<HTMLElement>>('host');

  /** Measured anchor centres (host-relative px), keyed `csv:<name>` / `field:<key>`. */
  private anchors = signal<Map<string, Point>>(new Map());

  /** In-progress drag origin + live cursor. */
  private dragFrom = signal<{ side: Side; key: string } | null>(null);
  private dragCursor = signal<Point | null>(null);

  /** Which side is currently being dragged from (drives drop-target highlight). */
  protected readonly draggingSide = computed<Side | null>(() => this.dragFrom()?.side ?? null);

  constructor() {
    afterNextRender(() => {
      this.measure();
      const hostEl = this.host()?.nativeElement;
      if (hostEl) {
        new ResizeObserver(() => this.measure()).observe(hostEl);
      }
    });

    // Re-measure whenever the columns, fields, or connections change (rows reflow).
    effect(() => {
      this.csvColumns();
      this.targetFields();
      this.connections();
      requestAnimationFrame(() => this.measure());
    });
  }

  // --- anchor ids (used as data-anchor + dot keys) ---------------------------

  protected csvAnchor(name: string): string {
    return `csv:${name}`;
  }

  protected fieldAnchor(key: string): string {
    return `field:${key}`;
  }

  // --- colors ----------------------------------------------------------------

  /** Stable color for a CSV column's connector line / swatch. */
  protected colorFor(csvColumn: string): string {
    const i = this.csvColumns().indexOf(csvColumn);
    return CONNECTOR_PALETTE[(i < 0 ? 0 : i) % CONNECTOR_PALETTE.length];
  }

  // --- committed + in-progress path geometry ---------------------------------

  protected connectionPaths = computed(() => {
    const anchors = this.anchors();
    return this.connections()
      .map((conn) => {
        const a = anchors.get(`csv:${conn.csvColumn}`);
        const b = anchors.get(`field:${conn.targetField}`);
        return a && b ? { conn, d: this.bezier(a, b), color: this.colorFor(conn.csvColumn) } : null;
      })
      .filter((p): p is { conn: Mapping; d: string; color: string } => p !== null);
  });

  protected dragPath = computed<string | null>(() => {
    const from = this.dragFrom();
    const cursor = this.dragCursor();
    if (!from || !cursor) return null;
    const a = this.anchors().get(`${from.side}:${from.key}`);
    return a ? this.bezier(a, cursor) : null;
  });

  protected dragColor = computed<string>(() => {
    const from = this.dragFrom();
    return from?.side === 'csv' ? this.colorFor(from.key) : 'var(--p-primary-color)';
  });

  private bezier(a: Point, b: Point): string {
    const handle = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    const sign = b.x >= a.x ? 1 : -1;
    return `M ${a.x},${a.y} C ${a.x + handle * sign},${a.y} ${b.x - handle * sign},${b.y} ${b.x},${b.y}`;
  }

  // --- connected-state helpers (for template styling) ------------------------

  /** The field a CSV column is mapped to, if any. */
  protected mappedField(csvColumn: string): TargetField | undefined {
    const conn = this.connections().find((c) => c.csvColumn === csvColumn);
    return conn ? this.targetFields().find((f) => f.key === conn.targetField) : undefined;
  }

  /** CSV columns mapped into a given field (one for single, many for buckets). */
  protected mappedColumns(fieldKey: string): string[] {
    return this.connections()
      .filter((c) => c.targetField === fieldKey)
      .map((c) => c.csvColumn);
  }

  /** Dot color for a field — its first connected column's line color, or '' when unmapped. */
  protected fieldColor(fieldKey: string): string {
    const cols = this.mappedColumns(fieldKey);
    return cols.length ? this.colorFor(cols[0]) : '';
  }

  /** True while this card is the active drag source. */
  protected isSource(side: Side, key: string): boolean {
    const f = this.dragFrom();
    return !!f && f.side === side && f.key === key;
  }

  // --- pointer drag handling -------------------------------------------------

  protected startDrag(event: PointerEvent, side: Side, key: string): void {
    // Let clicks on chips / buttons (e.g. remove) through without starting a drag.
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragFrom.set({ side, key });
    this.dragCursor.set(this.toHost(event));
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragFrom()) return;
    this.dragCursor.set(this.toHost(event));
  }

  protected onPointerUp(event: PointerEvent): void {
    const from = this.dragFrom();
    this.dragFrom.set(null);
    this.dragCursor.set(null);
    if (!from) return;

    const target = this.dropTarget(event);
    if (!target || target.side === from.side) return; // must join opposite sides

    const csvColumn = from.side === 'csv' ? from.key : target.key;
    const targetField = from.side === 'field' ? from.key : target.key;
    this.connect(csvColumn, targetField);
  }

  private connect(csvColumn: string, targetField: string): void {
    const field = this.targetFields().find((f) => f.key === targetField);
    if (!field) return;

    // A CSV column participates in at most one connection.
    let next = this.connections().filter((c) => c.csvColumn !== csvColumn);
    // Single fields hold one connection — replace whatever was there.
    if (!field.multi) {
      next = next.filter((c) => c.targetField !== targetField);
    }
    next.push({ csvColumn, targetField });
    this.connections.set(next);
  }

  protected removeConnection(conn: Mapping): void {
    this.connections.set(this.connections().filter((c) => c !== conn));
  }

  /** Remove the (single) connection a CSV column participates in. */
  protected removeByColumn(csvColumn: string): void {
    this.connections.set(this.connections().filter((c) => c.csvColumn !== csvColumn));
  }

  /** Resolve the anchor under the pointer at drop time (pointer capture-safe). */
  private dropTarget(event: PointerEvent): { side: Side; key: string } | null {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const anchorEl = el?.closest<HTMLElement>('[data-anchor]');
    const id = anchorEl?.dataset['anchor'];
    if (!id) return null;
    const sep = id.indexOf(':');
    return { side: id.slice(0, sep) as Side, key: id.slice(sep + 1) };
  }

  private toHost(event: PointerEvent): Point {
    const rect = this.host()?.nativeElement.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // --- measurement -----------------------------------------------------------

  private measure(): void {
    const hostEl = this.host()?.nativeElement;
    if (!hostEl) return;
    const hostRect = hostEl.getBoundingClientRect();
    const next = new Map<string, Point>();
    hostEl.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
      const id = el.dataset['anchor'];
      if (!id) return;
      const r = el.getBoundingClientRect();
      next.set(id, {
        x: r.left + r.width / 2 - hostRect.left,
        y: r.top + r.height / 2 - hostRect.top,
      });
    });
    this.anchors.set(next);
  }
}
