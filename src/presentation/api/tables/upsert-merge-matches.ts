/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UpsertMatchRepository } from '@/application/ports/repositories/tables/upsert-match-repository'

/**
 * The rows an upsert would merge onto, asked of the `UpsertMatchRepository`
 * port, for the upsert's permission gates.
 */

/** Every row `input.fields` would merge onto. */
export const mergeMatchIds = (
  input: Parameters<UpsertMatchRepository['Service']['matchingIds']>[0]
) =>
  Effect.gen(function* () {
    const matches = yield* UpsertMatchRepository
    return yield* matches.matchingIds(input)
  })

/** Whether any record would merge onto a row the caller can see. */
export const anyMergeMatch = (input: Parameters<UpsertMatchRepository['Service']['anyMatch']>[0]) =>
  Effect.gen(function* () {
    const matches = yield* UpsertMatchRepository
    return yield* matches.anyMatch(input)
  })
