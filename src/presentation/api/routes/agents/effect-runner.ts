/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Composition root for the AI agent-approval DB mirror.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `ApprovalLayer`) so the agent route handlers depend only on the application
 * layer. It also owns the best-effort run policy that used to live in
 * `approval-db.ts`:
 *
 *   - `runApprovalMirror` provides the layer, runs a mirror effect, and
 *     DISCARDS any failure, so a DB write error never breaks the agent runtime
 *     (the authoritative state is the in-memory store; the DB write is
 *     fire-and-forget for spec readback).
 *   - `runApproverEmailLookup` provides the layer, runs the email lookup, and
 *     defaults to `''` on any failure, so the decision flow never throws on a
 *     missing/unreadable user.
 */

import { Effect } from 'effect'
import { ApprovalLayer, LookupApproverEmail } from '@/application/use-cases/agents/approval'
import type { ApprovalRecord } from './approval-store'
import type {
  ApprovalMirrorRecord,
  ApprovalRepository,
} from '@/application/ports/repositories/ai/approval-repository'

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
})

/** Provide ApprovalLayer to an Effect program (the mirror composition root). */
export function provideApprovalMirrorLive<A, E>(
  program: Effect.Effect<A, E, ApprovalRepository>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, ApprovalLayer)
}

/**
 * Run a mirror effect best-effort: the layer is provided here, and any DB
 * failure is silently discarded so the agent runtime is never affected.
 * Mirrors the former `.catch(() => undefined)` write semantics of
 * `approval-db.ts`.
 */
export const runApprovalMirror = async (
  program: Effect.Effect<void, unknown, ApprovalRepository>
): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements -- best-effort DB mirror; the Either result is intentionally discarded
  await Effect.runPromise(provideApprovalMirrorLive(program).pipe(Effect.either))
}

/**
 * Resolve the approving user's email by id, defaulting to `''` on any failure.
 * Preserves the former `lookupUserEmail` semantics: the decision flow must
 * never throw on a missing or unreadable user row.
 */
export const runApproverEmailLookup = async (userId: string): Promise<string> => {
  const result = await Effect.runPromise(
    provideApprovalMirrorLive(LookupApproverEmail(userId)).pipe(Effect.either)
  )
  return result._tag === 'Right' ? result.right : ''
}
