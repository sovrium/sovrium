/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { PreviewSession, PreviewSessionStatus } from '@/domain/models/system'

/**
 * Database error for preview-session operations.
 */
export class PreviewSessionDatabaseError extends Data.TaggedError('PreviewSessionDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Input shape for creating a new preview session row. The status is
 * always `'starting'` at creation time — the actual port-spawning code
 * (Phase 3) will transition the row to `'running'` once the child
 * server reports ready.
 */
export interface CreatePreviewSessionInput {
  readonly previewId: string
  readonly port: number
  readonly draftSnapshot: unknown
  readonly expiresAt: Date
  readonly createdByUserId: string
}

/**
 * Preview Session Repository Port.
 *
 * Backs `system.sovrium_preview_sessions`. Phase 1 persists the row
 * lifecycle; Phase 3 layers on the actual port-allocator and runtime
 * fork. Out of scope for Phase 1: the live process descriptor (PID,
 * shutdown handle) — those live in an in-memory Map keyed by
 * `previewId` inside the Phase 3 service.
 *
 * `pruneExpired` is intended to be called periodically (and from the
 * `swapApp` post-swap hook) so stale rows don't accumulate. It is the
 * only mutation that doesn't take a `previewId` — it bulk-marks every
 * row whose `expiresAt < now()` as `'expired'`.
 */
export class PreviewSessionRepository extends Context.Tag('PreviewSessionRepository')<
  PreviewSessionRepository,
  {
    readonly create: (
      input: CreatePreviewSessionInput
    ) => Effect.Effect<PreviewSession, PreviewSessionDatabaseError>
    readonly get: (
      previewId: string
    ) => Effect.Effect<PreviewSession | undefined, PreviewSessionDatabaseError>
    readonly list: () => Effect.Effect<readonly PreviewSession[], PreviewSessionDatabaseError>
    /** Transitions the row to `'stopped'`. Idempotent. */
    readonly markStopped: (previewId: string) => Effect.Effect<void, PreviewSessionDatabaseError>
    /** Returns the number of rows that were transitioned to `'expired'`. */
    readonly pruneExpired: () => Effect.Effect<number, PreviewSessionDatabaseError>
    /**
     * Optional hook used by Phase 3's lifecycle callbacks (when the
     * child process reports `ready` or `crashed`). Phase 1 ships the
     * port surface so the repository can be reused without modification.
     */
    readonly updateStatus: (input: {
      readonly previewId: string
      readonly status: PreviewSessionStatus
    }) => Effect.Effect<void, PreviewSessionDatabaseError>
  }
>() {}
