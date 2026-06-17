/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { ApprovalLayer, LookupApproverEmail } from '@/application/use-cases/agents/approval'
import type { ApprovalRecord } from './approval-store'
import type {
  ApprovalMirrorRecord,
  ApprovalRepository,
} from '@/application/ports/repositories/ai/approval-repository'

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

export function provideApprovalMirrorLive<A, E>(
  program: Effect.Effect<A, E, ApprovalRepository>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, ApprovalLayer)
}

export const runApprovalMirror = async (
  program: Effect.Effect<void, unknown, ApprovalRepository>
): Promise<void> => {
  await Effect.runPromise(provideApprovalMirrorLive(program).pipe(Effect.either))
}

export const runApproverEmailLookup = async (userId: string): Promise<string> => {
  const result = await Effect.runPromise(
    provideApprovalMirrorLive(LookupApproverEmail(userId)).pipe(Effect.either)
  )
  return result._tag === 'Right' ? result.right : ''
}
