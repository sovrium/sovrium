/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Preview Session — Ephemeral Sandbox Runtime
 *
 * Represents one row in `system.sovrium_preview_sessions`. A preview is
 * an out-of-band Bun server spawned on a separate port from the live
 * server, running a candidate draft snapshot in isolation so the admin
 * can probe the new schema before publishing.
 *
 * Phase 1 of the schema-editing engagement persists the row + lifecycle
 * states; Phase 3 implements the actual port allocator and runtime fork.
 *
 * Status transitions:
 *   starting → running → stopped
 *           ↘──────────→ expired (TTL-driven)
 *
 * `port` is captured at creation so admins can reconnect without
 * re-discovering it via the start response.
 */

import { Data, Schema } from 'effect'

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------

export const PreviewSessionStatusSchema = Schema.Literal(
  'starting',
  'running',
  'stopped',
  'expired'
)

export type PreviewSessionStatus = typeof PreviewSessionStatusSchema.Type

// ---------------------------------------------------------------------------
// PreviewSession
// ---------------------------------------------------------------------------

export const PreviewSessionSchema = Schema.Struct({
  /**
   * Server-generated unique id. UUID-shaped but kept as a generic
   * non-empty string here so the use-case layer can choose its own
   * generation strategy without a domain-level coupling.
   */
  previewId: Schema.String.pipe(Schema.minLength(1)),
  port: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1024), Schema.lessThanOrEqualTo(65_535)),
  draftSnapshot: Schema.Unknown,
  expiresAt: Schema.DateFromSelf,
  status: PreviewSessionStatusSchema,
  createdByUserId: Schema.String.pipe(Schema.minLength(1)),
  createdAt: Schema.DateFromSelf,
}).pipe(
  Schema.annotations({
    identifier: 'PreviewSession',
    title: 'Preview Session (ephemeral sandbox runtime)',
    description:
      'Single ephemeral preview server descriptor. Phase 3 will materialise the actual port-spawning.',
  })
)

export type PreviewSession = typeof PreviewSessionSchema.Type

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised when a caller attempts to interact with a preview whose
 * `expiresAt` has passed. Handlers should treat this as a 410 Gone.
 */
export class PreviewExpiredError extends Data.TaggedError('PreviewExpiredError')<{
  readonly previewId: string
  readonly expiresAt: Date
}> {}

/**
 * Raised when the preview row cannot be found (already pruned, never
 * existed). Handlers should map to 404.
 */
export class PreviewNotFoundError extends Data.TaggedError('PreviewNotFoundError')<{
  readonly previewId: string
}> {}

/** @public */
export type PreviewSessionError = PreviewExpiredError | PreviewNotFoundError
