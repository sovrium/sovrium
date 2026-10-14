/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect, type Option } from 'effect'
import type { ChatMessage, ChatToolCall, ChatToolDefinition } from './ai-service'
import type { AgentCallerGrant } from '@/domain/models/app/agents/agent-gate-validation'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import type {
  ElicitationAnswer,
  ElicitationRequest,
} from '@/domain/models/app/agents/ask-user-service'

/** The surface an agent turn was started on. */
export type AgentSurface = 'chat' | 'automation' | 'schedule'

/**
 * The person an agent turn answers — on a chat turn, whoever is chatting. Her
 * reach caps the agent's: each call is pre-checked against her table grants
 * (`grantOn`), and a record action then runs AS her, under the records API's
 * row-level rules and field audiences. `userId` is absent for a visitor signed
 * in to nothing, who makes no record action at all.
 */
export interface AgentCaller {
  readonly userId: string | undefined
  /** Her account role, the records route's effective roles on `table`, and whether she is signed out. */
  readonly grantOn: (table: string | undefined) => AgentCallerGrant
}

/**
 * What a paused turn needs to go on once its held call is approved: the call
 * itself, the conversation up to it, and how the turn was being run.
 */
export interface ApprovalContinuation {
  readonly surface: AgentSurface
  /** The person the paused turn answered; the approved call still runs as her. */
  readonly caller?: AgentCaller | undefined
  readonly call: ChatToolCall
  /** The conversation up to and including the assistant message that made the call. */
  readonly messages: ReadonlyArray<ChatMessage>
  readonly tools: ReadonlyArray<ChatToolDefinition>
  /** Model calls the turn had left when it paused. */
  readonly remainingSteps: number
}

/**
 * A question a turn waits on (`ask_user`, or an external MCP server's
 * `elicitation/create`), by its id. Once the call is resolved it also carries
 * what the turn goes on with when the answer comes, like a held call's
 * continuation.
 */
export interface PendingElicitation extends ElicitationRequest {
  readonly id: string
  readonly continuation?: ApprovalContinuation | undefined
  /** The declared name of the MCP server asking; absent for the agent's own question. */
  readonly server?: string | undefined
  /**
   * A server's question only: send the person's answer to the server, let its
   * tool call finish, and yield what the model reads as that call's result.
   */
  readonly relay?: ((answer: ElicitationAnswer) => Effect.Effect<string>) | undefined
}

/** One agent action on the in-process activity feed (`GET /api/activity`). */
export interface AgentActionFeedEntry {
  readonly agentName: string
  readonly action: string
  readonly targetTable: string | undefined
  readonly recordId: string | undefined
  readonly runStartedById: string | undefined
}

/** One approval decision on the activity feed. */
export interface ApprovalDecisionFeedEntry {
  readonly action: 'approval.approved' | 'approval.rejected'
  readonly approvalId: string
  readonly agentName: string
  readonly actor: { readonly id: string; readonly name: string; readonly email: string }
  readonly runStartedById: string | undefined
}

/**
 * An approval decision as the feed keeps it. `runStartedById` is kept for the
 * feed's audience rule and never reaches the wire.
 */
export interface ApprovalActivityEntry extends ApprovalDecisionFeedEntry {
  readonly id: string
  readonly createdAt: string
}

/**
 * An agent action as the feed keeps it, attributed to the agent
 * (`actor.type = 'agent'`). `targetTable` and `recordId` decide who reads it —
 * the records read gate of that table and row; `runStartedById` decides it for
 * an action that touches no table, and never reaches the wire.
 */
export interface AgentActivityEntry extends AgentActionFeedEntry {
  readonly id: string
  readonly actor: { readonly type: 'agent'; readonly name: string }
  readonly createdAt: string
}

/** One entry of `GET /api/activity`'s agent feed: a decision or an action. */
export type ActivityEntry = ApprovalActivityEntry | AgentActivityEntry

/**
 * Agent Approval Store Port
 *
 * Where agent approvals are kept while they wait for a human, with the
 * continuation of the turn each one paused, and the agent activity feed every
 * decision and action lands on. Process state, mirrored to the database by the
 * approval repository for read-back. Every reader and writer goes through this
 * port, never the process module behind it.
 */
export class AgentApprovalStore extends Context.Service<
  AgentApprovalStore,
  {
    /**
     * Keep a new pending approval, and the continuation of the turn it paused —
     * none for an approval that paused no turn (`POST /api/agents/:name/execute`).
     */
    readonly open: (
      record: ApprovalRecord,
      continuation?: ApprovalContinuation
    ) => Effect.Effect<void>
    /** The approval, as of now (expired / escalated when its instants have passed). */
    readonly get: (id: string) => Effect.Effect<Option.Option<ApprovalRecord>>
    /** Every approval of the agent, each as of now. */
    readonly list: (agentName: string) => Effect.Effect<ReadonlyArray<ApprovalRecord>>
    /** Record a decision on an approval: the record with `patch` applied, or none for an unknown id. */
    readonly decide: (
      id: string,
      patch: Partial<ApprovalRecord>
    ) => Effect.Effect<Option.Option<ApprovalRecord>>
    /** Put one approval decision on the activity feed. */
    readonly recordDecision: (entry: ApprovalDecisionFeedEntry) => Effect.Effect<void>
    /** Take the continuation of an approval; a second take finds none. */
    readonly takeContinuation: (id: string) => Effect.Effect<Option.Option<ApprovalContinuation>>
    /** Mark an approved action as run under the agent's identity. */
    readonly markExecuted: (id: string) => Effect.Effect<void>
    /** Put one agent action on the activity feed. */
    readonly recordAction: (entry: AgentActionFeedEntry) => Effect.Effect<void>
    /** The activity feed, decisions and actions, oldest first. */
    readonly activity: Effect.Effect<ReadonlyArray<ActivityEntry>>
  }
>()('AgentApprovalStore') {}
