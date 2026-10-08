/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Application use-cases for the AI chat dynamic-record reads.
 *
 * Thin pass-throughs over the `DynamicRecordRepository` port — the presentation
 * chat routes (`chat-query.ts` / `chat-mutation.ts`) consume them via
 * `Effect.runPromise`, the infrastructure layer supplies the live Drizzle
 * implementation. No direct database access happens here. The pass-through
 * layer is intentional (see refactor-audit P2.1): it keeps the layer boundary
 * correct and gives future orchestration a hook without the presentation route
 * reaching a repository directly.
 */

import { Effect } from 'effect'
import {
  DynamicRecordRepository,
  type DynamicRecordAggregateInput,
  type DynamicRecordCountInput,
  type DynamicRecordError,
  type DynamicRecordListInput,
} from '@/application/ports/repositories/tables/dynamic-record-repository'

/** Run a `COUNT(*)` over a dynamic table. */
export const countDynamicRecords = (
  input: DynamicRecordCountInput
): Effect.Effect<number, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.count(input)
  }).pipe(Effect.withSpan('ai.count-dynamic-records'))

/** Run an `AVG`/`SUM` aggregate over a numeric column of a dynamic table. */
export const aggregateDynamicRecords = (
  input: DynamicRecordAggregateInput
): Effect.Effect<number | undefined, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.aggregate(input)
  }).pipe(Effect.withSpan('ai.aggregate-dynamic-records'))

/** List rows of a dynamic table with an optional sort and a row cap. */
export const listDynamicRecords = (
  input: DynamicRecordListInput
): Effect.Effect<
  ReadonlyArray<Record<string, unknown>>,
  DynamicRecordError,
  DynamicRecordRepository
> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.list(input)
  }).pipe(Effect.withSpan('ai.list-dynamic-records'))
