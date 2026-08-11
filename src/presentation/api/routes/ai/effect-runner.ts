/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiLive } from '@/infrastructure/ai/layer'
import { AiActivityLogRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-activity-log-repository-live'
import { AiFactsRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-facts-repository-live'
import { AiMemoryRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-memory-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { DynamicRecordRepositoryLive } from '@/infrastructure/database/repositories/tables/dynamic-record-repository-live'

/**
 * Provide AiLive to an AI-route Effect program.
 *
 * Mirrors `provideStorageLive` in
 * `src/presentation/api/routes/buckets/effect-runner.ts`. Isolates the
 * infrastructure import so route handlers depend only on the application-
 * layer `AiService` port — keeps the presentation layer free of direct
 * infrastructure imports per the layer-based architecture.
 */
export function provideAiLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiLive) as Effect.Effect<A, E, never>
}

/**
 * Provide the `AiMemoryRepository` layer to an AI-route Effect program — the
 * durable chat-persistence path backing
 * `system.ai_conversations` / `system.ai_messages`. Used by the chat handlers
 * (to persist turns + load history) and the conversation list/get/delete
 * endpoints.
 */
export function provideAiMemoryRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiMemoryRepositoryLive) as Effect.Effect<A, E, never>
}

/**
 * Provide the `AiFactsRepository` layer to an AI-route Effect program — the
 * persistent learned-facts path backing
 * `system.ai_facts`. Used by the agent-bound chat handler (to extract + store
 * facts after a turn) and the `/api/ai/agents/:name/recall` endpoint.
 */
export function provideAiFactsRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiFactsRepositoryLive) as Effect.Effect<A, E, never>
}

/**
 * Provide the `AiActivityLogRepository` layer to an AI-route Effect program —
 * the activity-monitoring feed
 * backing `system.ai_activity_logs`. Used by the chat and agent activity-log
 * helpers to record one row per completed turn or agent action.
 */
export function provideAiActivityLogRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiActivityLogRepositoryLive) as Effect.Effect<A, E, never>
}

/**
 * Provide the `DynamicRecordRepository` layer to an AI-route Effect program —
 * the raw read-query / record-mutation SQL path backing the AI chat
 * record-queries and record-mutations flows ([internal ref] /
 * [internal ref]). Used by `chat-query.ts` and `chat-mutation.ts`
 * to run parameterised SQL against engine-created user tables without the
 * presentation layer holding any `sql`…`` literal.
 */
export function provideDynamicRecordRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, DynamicRecordRepositoryLive) as Effect.Effect<A, E, never>
}

/**
 * Provide the `AuthRepository` layer to an AI-route Effect program — the Better
 * Auth `user`-table access path. Used by `chat-mutation-flow.ts` to resolve the
 * acting user's email for activity-log attribution ([internal ref] /
 * [internal ref]).
 */
export function provideAuthRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AuthRepositoryLive) as Effect.Effect<A, E, never>
}
