/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export const countDynamicRecords = (
  input: DynamicRecordCountInput
): Effect.Effect<number, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.count(input)
  })

export const aggregateDynamicRecords = (
  input: DynamicRecordAggregateInput
): Effect.Effect<number | undefined, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.aggregate(input)
  })

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
  })

export const insertDynamicRecord = (
  input: DynamicRecordInsertInput
): Effect.Effect<number | string, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.insert(input)
  })

export const updateDynamicRecordById = (
  input: DynamicRecordUpdateByIdInput
): Effect.Effect<boolean, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.updateById(input)
  })

export const updateAllDynamicRecords = (
  input: DynamicRecordUpdateAllInput
): Effect.Effect<ReadonlyArray<number>, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.updateAll(input)
  })

export const deleteDynamicRecords = (
  input: DynamicRecordDeleteInput
): Effect.Effect<ReadonlyArray<number>, DynamicRecordError, DynamicRecordRepository> =>
  Effect.gen(function* () {
    const repo = yield* DynamicRecordRepository
    return yield* repo.delete(input)
  })
