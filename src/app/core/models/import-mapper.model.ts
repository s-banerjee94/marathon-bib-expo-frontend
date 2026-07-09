/**
 * Types and field configuration for the CSV → participant column-mapping route.
 * The deliverable is the {@link MappingConfig} JSON, which is the exact
 * `ImportMappingRequest` contract POSTed (as the `mapping` part) to
 * `POST /api/events/{eventId}/participants/batch-import`.
 *
 * Scalar target fields are fetched per-event from `import-fields` at runtime;
 * the two buckets below are always appended. Matching is positional by
 * `csvColumnIndex` — the header is not validated server-side.
 */

/** Determines how a target field behaves in the mapper. */
export type TargetFieldKind = 'required' | 'optional' | 'bucket';

/** A field on the right side of the mapper. */
export interface TargetField {
  /** Backend field key (sent as `targetField`); for buckets, the bucket name. */
  key: string;
  /** Label shown in the UI. */
  label: string;
  kind: TargetFieldKind;
  /** For `bucket` fields (goodies/other): accepts many CSV columns. */
  multi?: boolean;
  /** Optional hint rendered under the label. */
  hint?: string;
}

/** A single committed connection: one CSV column → one target field (internal drag state). */
export interface Mapping {
  csvColumn: string;
  targetField: string;
}

/** A single-value field mapping in the output JSON, addressed by column number. */
export interface MappedColumn {
  /** Zero-based physical position of the column in the CSV. */
  csvColumnIndex: number;
  /** Header text — kept for display and as a goodies/other map key. */
  csvColumn: string;
  targetField: string;
}

/** A bucket entry (goodies / other) in the output JSON, addressed by column number. */
export interface BucketColumn {
  csvColumnIndex: number;
  csvColumn: string;
}

/** The `ImportMappingRequest` contract produced by this route and sent to the backend. */
export interface MappingConfig {
  fileName: string;
  delimiter: string;
  hasHeader: boolean;
  totalRows: number;
  csvColumns: string[];
  /** Single-value field mappings (everything except the buckets). */
  mappings: MappedColumn[];
  /** CSV columns funnelled into the goodies key/value map (keyed by header). */
  goodies: BucketColumn[];
  /** CSV columns funnelled into the "other" key/value map (keyed by header). */
  other: BucketColumn[];
}

/**
 * The two fixed bucket fields. They are not returned by `import-fields` — every
 * scalar field comes from that endpoint at runtime; these are always appended as
 * multi-value sinks (stored as key/value maps keyed by the original header text).
 */
export const BUCKET_FIELDS: TargetField[] = [
  {
    key: 'goodies',
    label: 'Goodies',
    kind: 'bucket',
    multi: true,
    hint: 'many columns → key/value map',
  },
  {
    key: 'other',
    label: 'Other',
    kind: 'bucket',
    multi: true,
    hint: 'unmatched columns → key/value map',
  },
];

/** Bucket keys, for distinguishing scalar mappings from bucket entries. */
export const BUCKET_KEYS: ReadonlySet<string> = new Set(BUCKET_FIELDS.map((f) => f.key));

/**
 * Fields that MUST be mapped before importing. The live `import-fields` endpoint
 * currently under-reports its `required` flags (only bibNumber/fullName), so the
 * client also treats this set as required: a field is required-to-map when the
 * catalog says so OR its key appears here. If the backend catalog is later
 * corrected to mark all of these required, this stays consistent (union).
 */
export const REQUIRED_TO_MAP: ReadonlySet<string> = new Set([
  'chipNumber',
  'bibNumber',
  'fullName',
  'age',
  'gender',
  'raceName',
  'categoryName',
  'phoneNumber',
]);

/** Optional hints shown under known scalar fields (labels come from the backend). */
export const FIELD_HINTS: Record<string, string> = {
  gender: 'M / F / O',
  phoneNumber: '10 digits',
  raceName: 'name — ID resolved by backend',
  categoryName: 'name — ID resolved by backend',
};
