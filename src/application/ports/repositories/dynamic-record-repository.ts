/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface DynamicRecordFilter {
  readonly column: string
  readonly value: string
}

export class DynamicRecordError extends Data.TaggedError('DynamicRecordError')<{
  readonly cause: unknown
}> {}

export interface DynamicRecordCountInput {
  readonly table: string
  readonly filter?: DynamicRecordFilter | undefined
}

export interface DynamicRecordAggregateInput {
  readonly table: string
  readonly fn: 'AVG' | 'SUM'
  readonly column: string
  readonly filter?: DynamicRecordFilter | undefined
}

export interface DynamicRecordListInput {
  readonly table: string
  readonly filter?: DynamicRecordFilter | undefined
  readonly sortColumn?: string | undefined
  readonly limit: number
}

export interface DynamicRecordInsertInput {
  readonly table: string
  readonly data: Readonly<Record<string, unknown>>
}

export interface DynamicRecordUpdateByIdInput {
  readonly table: string
  readonly recordId: number
  readonly data: Readonly<Record<string, unknown>>
}

export interface DynamicRecordUpdateAllInput {
  readonly table: string
  readonly data: Readonly<Record<string, unknown>>
}

export interface DynamicRecordDeleteInput {
  readonly table: string
  readonly filter?: DynamicRecordFilter | undefined
}

export interface DynamicRecordRawQueryInput {
  readonly sql: string
}

export class DynamicRecordRepository extends Context.Tag('DynamicRecordRepository')<
  DynamicRecordRepository,
  {
    readonly count: (input: DynamicRecordCountInput) => Effect.Effect<number, DynamicRecordError>
    readonly aggregate: (
      input: DynamicRecordAggregateInput
    ) => Effect.Effect<number | undefined, DynamicRecordError>
    readonly list: (
      input: DynamicRecordListInput
    ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, DynamicRecordError>
    readonly insert: (
      input: DynamicRecordInsertInput
    ) => Effect.Effect<number | string, DynamicRecordError>
    readonly updateById: (
      input: DynamicRecordUpdateByIdInput
    ) => Effect.Effect<boolean, DynamicRecordError>
    readonly updateAll: (
      input: DynamicRecordUpdateAllInput
    ) => Effect.Effect<ReadonlyArray<number>, DynamicRecordError>
    readonly delete: (
      input: DynamicRecordDeleteInput
    ) => Effect.Effect<ReadonlyArray<number>, DynamicRecordError>
    readonly runRawQuery: (
      input: DynamicRecordRawQueryInput
    ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, DynamicRecordError>
  }
>() {}
