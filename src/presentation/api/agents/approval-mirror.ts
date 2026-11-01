/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The best-effort run policy for the AI agent-approval DB mirror.
 *
 * It owns that policy:
 *
 *   - `mirrorBestEffort` logs and DISCARDS any failure of a mirror effect, so a
 *     DB write error never breaks the agent runtime (the authoritative state
 *     is the in-memory store; the DB write is for spec readback).
 *   - `approverIdentityOrBlank` runs the email-and-name lookup the same way
 *     and defaults to `''` on any failure, so the decision flow never fails
 *     on a missing/unreadable user.
 */

import { Effect } from 'effect'
import { lookupApproverIdentity } from '@/application/use-cases/agents/approval'
import { logError } from '@/infrastructure/logging/logger'
import type {
  ApprovalMirrorRecord,
  ApprovalRepository,
  ApprovalUserIdentity,
} from '@/application/ports/repositories/ai/approval-repository'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'

/**
 * Map the presentation in-memory `ApprovalRecord` onto the port-level
 * `ApprovalMirrorRecord` — exactly the fields the DB write needs. Keeps the
 * application/port layer free of the presentation `ApprovalRecord` type.
 */
export const toMirrorRecord = (record: Readonly<ApprovalRecord>): ApprovalMirrorRecord => ({
  id: record.id,
  status: record.status,
  agentName: record.agentName,
  actionPayload: record.actionPayload,
  actionExecuted: record.actionExecuted,
  timeoutSeconds: record.timeoutSeconds,
  escalated: record.escalated,
  executedAs: record.executedAs,
  escalatedTo: record.escalatedTo,
  expiresAtMs: record.expiresAtMs,
  requestedById: record.requestedById,
})

const logMirrorCause = (message: string) =>
  Effect.tapCause((cause) =>
    Effect.sync(() => {
      logError(message, cause)
    })
  )

/**
 * A mirror effect, best-effort: a DB failure is logged and discarded so the
 * agent runtime is never affected.
 */
export const mirrorBestEffort = (
  program: Effect.Effect<void, unknown, ApprovalRepository>
): Effect.Effect<void, never, ApprovalRepository> =>
  // effect-swallow: the in-memory store is authoritative; the mirror is only its readback.
  program.pipe(
    logMirrorCause('[agents] approval mirror write failed'),
    Effect.result,
    Effect.asVoid
  )

/**
 * The approving user's email and name by id, each defaulting to `''` on any
 * failure: the decision flow must never fail on a missing or unreadable user
 * row.
 */
export const approverIdentityOrBlank = (
  userId: string
): Effect.Effect<ApprovalUserIdentity, never, ApprovalRepository> =>
  lookupApproverIdentity(userId).pipe(
    logMirrorCause('[agents] approver identity lookup failed'),
    // effect-swallow: a blank approver identity must not stop a decision the person is entitled to.
    Effect.orElseSucceed(() => ({ email: '', name: '' }))
  )
