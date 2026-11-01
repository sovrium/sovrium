/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The agent approval store, as the agent routes reach it: through
 * the `AgentApprovalStore` port on the server's own runtime — the same store
 * the agent runtime opens approvals in and resumes turns from — never through
 * the process module behind the port.
 */

import { Effect, Option } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import type {
  AgentActionFeedEntry,
  ApprovalDecisionFeedEntry,
} from '@/application/ports/services/agent-approval-store'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'

const onStore = <A>(
  use: (store: AgentApprovalStore['Service']) => Effect.Effect<A>
): Effect.Effect<A, never, AgentApprovalStore> =>
  Effect.flatMap(Effect.service(AgentApprovalStore), use)

/** Keep an approval that paused no turn. */
export const openApproval = (
  record: ApprovalRecord
): Effect.Effect<void, never, AgentApprovalStore> => onStore((store) => store.open(record))

/** The approval as of now, or `undefined` for an unknown id. */
export const readApproval = (
  id: string
): Effect.Effect<ApprovalRecord | undefined, never, AgentApprovalStore> =>
  onStore((store) => Effect.map(store.get(id), Option.getOrUndefined))

/** Every approval of `agentName`, each as of now. */
export const listApprovals = (
  agentName: string
): Effect.Effect<ReadonlyArray<ApprovalRecord>, never, AgentApprovalStore> =>
  onStore((store) => store.list(agentName))

/** Apply a decision's `patch`; `undefined` for an unknown id. */
export const decideApproval = (
  id: string,
  patch: Partial<ApprovalRecord>
): Effect.Effect<ApprovalRecord | undefined, never, AgentApprovalStore> =>
  onStore((store) => Effect.map(store.decide(id, patch), Option.getOrUndefined))

/** Put an approval decision on the activity feed. */
export const recordApprovalDecision = (
  entry: ApprovalDecisionFeedEntry
): Effect.Effect<void, never, AgentApprovalStore> => onStore((store) => store.recordDecision(entry))

/** Put an agent action on the activity feed. */
export const recordFeedAction = (
  entry: AgentActionFeedEntry
): Effect.Effect<void, never, AgentApprovalStore> => onStore((store) => store.recordAction(entry))
