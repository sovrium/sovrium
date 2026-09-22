/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Application use-cases for the AI chat dynamic-record SQL paths
 *.
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
  type DynamicRecordDeleteInput,
  type DynamicRecordError,
  type DynamicRecordInsertInput,
  type DynamicRecordListInput,
  type DynamicRecordUpdateAllInput,
  type DynamicRecordUpdateByIdInput,
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

/** Insert one row into a dynamic table; resolves the generated id. */
export const insertDynamicRecord = (
  input: DynamicRecordInsertInput
): Effect.Effect<number | string, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.insert(input)
  }).pipe(Effect.withSpan('ai.insert-dynamic-record'))

/** Update a single row of a dynamic table by its `id`. */
export const updateDynamicRecordById = (
  input: DynamicRecordUpdateByIdInput
): Effect.Effect<boolean, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.updateById(input)
  }).pipe(Effect.withSpan('ai.update-dynamic-record-by-id'))

/** Update every row of a dynamic table; resolves the affected ids. */
export const updateAllDynamicRecords = (
  input: DynamicRecordUpdateAllInput
): Effect.Effect<ReadonlyArray<number>, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.updateAll(input)
  }).pipe(Effect.withSpan('ai.update-all-dynamic-records'))

/** Hard-delete rows from a dynamic table; resolves the deleted ids. */
export const deleteDynamicRecords = (
  input: DynamicRecordDeleteInput
): Effect.Effect<ReadonlyArray<number>, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- `repo` is the DynamicRecordRepository port, not a Drizzle table; the WHERE filter lives in `input.filter`
    return yield* repo.delete(input)
  }).pipe(Effect.withSpan('ai.delete-dynamic-records'))
