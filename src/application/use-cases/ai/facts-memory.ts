/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AiFactsRepository,
  type AiFact,
  type AiFactsDatabaseError,
} from '@/application/ports/repositories/ai-facts-repository'


export const extractAndStoreFact = (input: {
  readonly namespace: string
  readonly agentName: string
  readonly userId: string
  readonly fact: string
  readonly maxFacts: number
}): Effect.Effect<void, AiFactsDatabaseError, AiFactsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiFactsRepository
    yield* repo.storeFact(input)
  })

export const recallAgentFacts = (input: {
  readonly namespace: string
  readonly userId: string
}): Effect.Effect<ReadonlyArray<AiFact>, AiFactsDatabaseError, AiFactsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiFactsRepository
    return yield* repo.recallFacts(input)
  })
