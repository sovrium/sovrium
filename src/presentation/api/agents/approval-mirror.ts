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
 *   - `runApprovalMirror` runs a mirror effect on the caller's services and
 *     DISCARDS any failure, so a DB write error never breaks the agent runtime
 *     (the authoritative state is the in-memory store; the DB write is
 *     fire-and-forget for spec readback).
 *   - `runApproverIdentityLookup` runs the email-and-name lookup the same way
 *     and defaults to `''` on any failure, so the decision flow never throws
 *     on a missing/unreadable user.
 */

/**
 * NOT A COMPOSITION ROOT — which is why it is not called `effect-runner.ts`.
 *
 * Neither entry point provides a layer for itself, even though one of them is
 * reached from `agent-schedule-runner.ts`, which the cron scheduler drives on a
 * timer with no Hono context in sight. The approval layer is part of the set
 * the server resolves at boot, and BOTH callers hand the resolved services in: a route reads them off its request, and the scheduler
 * captures them once at registration and closes over them.
 *
 * What survives here is the best-effort RUN POLICY, which is a real decision
 * and belongs in one place: a mirror failure is discarded so the agent runtime
 * is never affected (the authoritative state is the in-memory store), and an
 * approver-identity lookup defaults to `''` so the decision flow cannot throw on a
 * missing user row.
 */

import { Effect } from 'effect'
import { LookupApproverIdentity } from '@/application/use-cases/agents/approval'
import type { ApprovalRecord } from './approval-store'
import type {
  ApprovalMirrorRecord,
  ApprovalRepository,
  ApprovalUserIdentity,
} from '@/application/ports/repositories/ai/approval-repository'
import type { Context } from 'effect'

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

/** The one service both entry points need, as a value the caller supplies. */
export type ApprovalServices = Context.Context<ApprovalRepository>

/**
 * Run a mirror effect best-effort: any DB failure is silently discarded so the
 * agent runtime is never affected. Mirrors the former `.catch(() => undefined)`
 * write semantics of `approval-db.ts`.
 */
export const runApprovalMirror = async (
  services: ApprovalServices,
  program: Effect.Effect<void, unknown, ApprovalRepository>
): Promise<void> => {
  await Effect.runPromise(Effect.provide(program.pipe(Effect.result), services))
}

/**
 * Resolve the approving user's email and name by id, each defaulting to `''`
 * on any failure: the decision flow must never throw on a missing or
 * unreadable user row.
 */
export const runApproverIdentityLookup = async (
  services: ApprovalServices,
  userId: string
): Promise<ApprovalUserIdentity> => {
  const result = await Effect.runPromise(
    Effect.provide(LookupApproverIdentity(userId).pipe(Effect.result), services)
  )
  return result._tag === 'Success' ? result.success : { email: '', name: '' }
}
