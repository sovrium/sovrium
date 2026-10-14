/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Option } from 'effect'
import {
  AgentApprovalStore,
  type ApprovalContinuation,
} from '@/application/ports/services/agent-approval-store'
import {
  appendActivityEntry,
  appendAgentActivityEntry,
  getApproval,
  listActivityEntries,
  listApprovalsForAgent,
  putApproval,
  refreshApproval,
  updateApproval,
} from './agent-approval-store'

/**
 * Continuations of paused turns, by approval id. Process-local, like the
 * approvals themselves: a restart forgets a paused turn, and its approval then
 * runs nothing when approved — it never runs a call it no longer has.
 */
const continuations = new Map<string, ApprovalContinuation>()

export const AgentApprovalStoreLive = Layer.succeed(AgentApprovalStore, {
  open: (record, continuation) =>
    Effect.sync(() => {
      putApproval(record)
      if (continuation !== undefined) continuations.set(record.id, continuation)
    }),
  get: (id) =>
    Effect.sync(() => {
      const record = getApproval(id)
      return record === undefined ? Option.none() : Option.some(refreshApproval(record))
    }),
  list: (agentName) =>
    Effect.sync(() => listApprovalsForAgent(agentName).map((record) => refreshApproval(record))),
  decide: (id, patch) => Effect.sync(() => Option.fromUndefinedOr(updateApproval(id, patch))),
  recordDecision: (entry) =>
    Effect.sync(() => {
      appendActivityEntry({
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      })
    }),
  activity: Effect.sync(() => listActivityEntries()),
  takeContinuation: (id) =>
    Effect.sync(() => {
      const continuation = continuations.get(id)
      continuations.delete(id)
      return Option.fromUndefinedOr(continuation)
    }),
  markExecuted: (id) =>
    Effect.sync(() => {
      const record = getApproval(id)
      if (record !== undefined) {
        updateApproval(id, { actionExecuted: true, executedAs: record.agentName })
      }
    }),
  recordAction: (entry) =>
    Effect.sync(() => {
      appendAgentActivityEntry({
        id: crypto.randomUUID(),
        action: entry.action,
        agentName: entry.agentName,
        actor: { type: 'agent', name: entry.agentName },
        targetTable: entry.targetTable,
        recordId: entry.recordId,
        createdAt: new Date().toISOString(),
        runStartedById: entry.runStartedById,
      })
    }),
})
