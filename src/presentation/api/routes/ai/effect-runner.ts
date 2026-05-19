/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiLive } from '@/infrastructure/ai/layer'
import { AiActivityLogRepositoryLive } from '@/infrastructure/database/repositories/ai-activity-log-repository-live'
import { AiFactsRepositoryLive } from '@/infrastructure/database/repositories/ai-facts-repository-live'
import { AiMemoryRepositoryLive } from '@/infrastructure/database/repositories/ai-memory-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'
import { DynamicRecordRepositoryLive } from '@/infrastructure/database/repositories/dynamic-record-repository-live'

export function provideAiLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiLive) as Effect.Effect<A, E, never>
}

export function provideAiMemoryRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiMemoryRepositoryLive) as Effect.Effect<A, E, never>
}

export function provideAiFactsRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiFactsRepositoryLive) as Effect.Effect<A, E, never>
}

export function provideAiActivityLogRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AiActivityLogRepositoryLive) as Effect.Effect<A, E, never>
}

export function provideDynamicRecordRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, DynamicRecordRepositoryLive) as Effect.Effect<A, E, never>
}

export function provideAuthRepoLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AuthRepositoryLive) as Effect.Effect<A, E, never>
}
