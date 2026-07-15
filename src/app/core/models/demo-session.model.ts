// Contracts for the public landing-page live QR demo (/api/public/demo/**).
// Sessions are fabricated, in-memory, and short-lived on the backend; EXPIRED
// never appears in a body — expiry always arrives as HTTP 410 (then 404 after
// eviction), so both map to the same "grab a fresh QR" handling.
export type DemoSessionStatus = 'CREATED' | 'SCANNED' | 'COLLECTED';

export interface DemoRunner {
  name: string;
  bib: string;
  category: string;
}

export interface DemoSessionResponse {
  /** 22-char URL-safe code — path-safe as-is, no encoding needed. */
  code: string;
  runner: DemoRunner;
  /** Server-computed seconds of remaining validity. Anchor on receipt
   * (`Date.now() + expiresInSeconds * 1000`) — the client clock never matters. */
  expiresInSeconds: number;
}

export interface DemoSessionStatusResponse {
  status: DemoSessionStatus;
}
