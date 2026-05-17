/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * App Draft — Mutable Working Copy
 *
 * Singleton-per-app working copy of the schema, separated from the
 * immutable version history. Multi-admin concurrent edits are guarded
 * by `baseVersion` optimistic concurrency on publish:
 *
 *   - Admin A reads draft (baseVersion=5).
 *   - Admin B reads draft (baseVersion=5), edits, publishes → version 6.
 *   - Admin A's draft.baseVersion (5) no longer matches active (6) → conflict.
 *
 * The `DraftBaseVersionMismatchError` carries both the expected and actual
 * version numbers so the API handler can render a meaningful 409 response
 * AND so MCP tool consumers can decide whether to rebase or surface to the
 * admin.
 */

import { Data, Schema } from 'effect'

// ---------------------------------------------------------------------------
// AppDraft
// ---------------------------------------------------------------------------

export const AppDraftSchema = Schema.Struct({
  /**
   * Encoded App snapshot — same shape as `Schema.encode(AppSchema)`. Kept
   * as `Schema.Unknown` so this domain file can be referenced from
   * presentation/zod-side code without pulling in the full `AppSchema`
   * recursion.
   */
  snapshot: Schema.Unknown,
  /**
   * The active version number this draft was branched from. Used as the
   * `If-Match`-style optimistic concurrency token on publish.
   */
  baseVersion: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  updatedAt: Schema.DateFromSelf,
  updatedByUserId: Schema.String.pipe(Schema.minLength(1)),
}).pipe(
  Schema.annotations({
    identifier: 'AppDraft',
    title: 'App Draft (mutable working copy)',
    description: 'Singleton-per-app draft. baseVersion enables optimistic concurrency on publish.',
  })
)

export type AppDraft = typeof AppDraftSchema.Type

// ---------------------------------------------------------------------------
// DraftMutationResult
// ---------------------------------------------------------------------------

/**
 * Returned from per-resource POST/PATCH/DELETE endpoints (e.g.
 * `POST /draft/tables`) so the caller learns the new draft state without
 * a separate `GET /draft` round-trip.
 */
export const DraftMutationResultSchema = Schema.Struct({
  draft: AppDraftSchema,
  /**
   * Whether the mutation actually changed the draft. False when the
   * request was a no-op (e.g. PATCH with identical fields).
   */
  changed: Schema.Boolean,
}).pipe(
  Schema.annotations({
    identifier: 'DraftMutationResult',
    title: 'Draft mutation result',
    description: 'Returned by per-resource draft mutations: the post-mutation draft + change flag.',
  })
)

/** @public */
export type DraftMutationResult = typeof DraftMutationResultSchema.Type

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised on `POST /draft/publish` when the body's `baseVersion` does not
 * match the current active version — i.e. another admin published in
 * between this admin's last GET /draft and their POST /publish.
 *
 * Maps to HTTP 409 Conflict. The handler should include both numbers in
 * the response body so the client can decide to refetch + rebase.
 */
export class DraftBaseVersionMismatchError extends Data.TaggedError(
  'DraftBaseVersionMismatchError'
)<{
  readonly expected: number
  readonly actual: number
}> {}
