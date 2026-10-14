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
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import type {
  AgentActionFeedEntry,
  ApprovalDecisionFeedEntry,
} from '@/application/ports/services/agent-approval-store'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

const onStore = <A>(
  services: DomainContext,
  use: (store: AgentApprovalStore['Service']) => Effect.Effect<A>
): Promise<A> => runOnDomain(services, Effect.flatMap(Effect.service(AgentApprovalStore), use))

/** Keep an approval that paused no turn. */
export const openApproval = (services: DomainContext, record: ApprovalRecord): Promise<void> =>
  onStore(services, (store) => store.open(record))

/** The approval as of now, or `undefined` for an unknown id. */
export const readApproval = (
  services: DomainContext,
  id: string
): Promise<ApprovalRecord | undefined> =>
  onStore(services, (store) => Effect.map(store.get(id), Option.getOrUndefined))

/** Every approval of `agentName`, each as of now. */
export const listApprovals = (
  services: DomainContext,
  agentName: string
): Promise<ReadonlyArray<ApprovalRecord>> => onStore(services, (store) => store.list(agentName))

/** Apply a decision's `patch`; `undefined` for an unknown id. */
export const decideApproval = (
  services: DomainContext,
  id: string,
  patch: Partial<ApprovalRecord>
): Promise<ApprovalRecord | undefined> =>
  onStore(services, (store) => Effect.map(store.decide(id, patch), Option.getOrUndefined))

/** Put an approval decision on the activity feed. */
export const recordApprovalDecision = (
  services: DomainContext,
  entry: ApprovalDecisionFeedEntry
): Promise<void> => onStore(services, (store) => store.recordDecision(entry))

/** Put an agent action on the activity feed. */
export const recordFeedAction = (
  services: DomainContext,
  entry: AgentActionFeedEntry
): Promise<void> => onStore(services, (store) => store.recordAction(entry))
