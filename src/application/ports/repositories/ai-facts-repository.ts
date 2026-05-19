/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AiFactsDatabaseError extends Data.TaggedError('AiFactsDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AiFact {
  readonly fact: string
  readonly namespace: string
  readonly agentName: string
  readonly userId: string
  readonly createdAt: Date
}

export class AiFactsRepository extends Context.Tag('AiFactsRepository')<
  AiFactsRepository,
  {
    readonly storeFact: (input: {
      readonly namespace: string
      readonly agentName: string
      readonly userId: string
      readonly fact: string
      readonly maxFacts: number
    }) => Effect.Effect<void, AiFactsDatabaseError>
    readonly recallFacts: (input: {
      readonly namespace: string
      readonly userId: string
    }) => Effect.Effect<ReadonlyArray<AiFact>, AiFactsDatabaseError>
  }
>() {}
