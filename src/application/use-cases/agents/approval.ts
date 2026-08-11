/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the AI agent-approval DB mirror.
 *
 * The authoritative runtime state for agent approvals is the presentation
 * in-memory store (`approval-store.ts`). These use cases mirror a subset of
 * that state into `system.automation_approval_requests` (so DB-readback spec
 * assertions observe the row) and resolve the approver's email for a decision.
 *
 * They are thin wrappers over {@link ApprovalRepository}: no shaping logic is
 * needed (the route already maps its `ApprovalRecord` onto the port-level
 * `ApprovalMirrorRecord`). The best-effort discard-on-error and the `''`
 * email-lookup default are applied by the route-side runner, NOT here — the
 * use-case/port contract stays honest about the possible
 * {@link ApprovalDatabaseError}.
 */

import { Effect, Layer } from 'effect'
import {
  ApprovalRepository,
  type ApprovalDatabaseError,
  type ApprovalMirrorRecord,
} from '@/application/ports/repositories/ai/approval-repository'
import { ApprovalRepositoryLive } from '@/infrastructure/database/repositories/ai/approval-repository-live'

/** Mirror a freshly created agent-approval record into the DB table. */
export const MirrorApprovalCreate = (
  record: ApprovalMirrorRecord
): Effect.Effect<void, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    yield* repo.insertApprovalRow(record)
  })

/** Mirror an updated agent-approval record into the DB table. */
export const MirrorApprovalUpdate = (
  record: ApprovalMirrorRecord
): Effect.Effect<void, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    yield* repo.updateApprovalRow(record)
  })

/** Resolve an approving user's email address by id (the read-side lookup). */
export const LookupApproverEmail = (
  userId: string
): Effect.Effect<string, ApprovalDatabaseError, ApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* ApprovalRepository
    return yield* repo.lookupUserEmail(userId)
  })

/**
 * Application layer for the agent-approval mirror use cases.
 */
export const ApprovalLayer = Layer.mergeAll(ApprovalRepositoryLive)
