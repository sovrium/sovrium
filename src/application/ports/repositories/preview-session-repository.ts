/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { PreviewSession, PreviewSessionStatus } from '@/domain/models/system'

export class PreviewSessionDatabaseError extends Data.TaggedError('PreviewSessionDatabaseError')<{
  readonly cause: unknown
}> {}

export interface CreatePreviewSessionInput {
  readonly previewId: string
  readonly port: number
  readonly draftSnapshot: unknown
  readonly expiresAt: Date
  readonly createdByUserId: string
}

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
    readonly markStopped: (previewId: string) => Effect.Effect<void, PreviewSessionDatabaseError>
    readonly pruneExpired: () => Effect.Effect<number, PreviewSessionDatabaseError>
    readonly updateStatus: (input: {
      readonly previewId: string
      readonly status: PreviewSessionStatus
    }) => Effect.Effect<void, PreviewSessionDatabaseError>
  }
>() {}
