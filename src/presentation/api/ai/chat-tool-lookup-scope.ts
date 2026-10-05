/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A chat tool's lookups, judged by their linked records as the records API
 * judges them.
 *
 * A lookup into a table or field the reader may not read never reaches a tool:
 * the tool's columns leave it out (`chatReadableColumns`). A lookup through a
 * link to a record a row-level rule hides from her is a question about each
 * row, so it is asked with the rows in hand, through the records API's own
 * helpers:
 *
 *  - the rows a `query_<table>` call returns pass through the same per-row
 *    omission a records read applies ({@link omitHiddenLookups}) — the lookup,
 *    and every formula over it, left out where the linked record is hidden;
 *  - a filter or a sort on such a lookup reads the records list's own masks
 *    ({@link lookupReadMasks}), so a `count_<table>` on a guess at a hidden
 *    value cannot confirm it.
 *
 * The rows are judged for the PERSON the tool answers: the signed-in caller,
 * the person a declared agent answers, or a visitor signed in to nothing. A
 * declared agent answering no one reads every row of a table it may read, so
 * nothing is judged for it.
 */

import { Effect } from 'effect'
import {
  countDynamicRecords,
  listDynamicRecords,
} from '@/application/use-cases/ai/dynamic-record-query'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { omitHiddenLookups } from '@/application/use-cases/tables/hidden-lookup-omission'
import { lookupReadMasks } from '@/application/use-cases/tables/lookup-read-masks'
import { lookupKeyColumnsFor } from '@/domain/models/app/tables/lookup-link-service'
import type { ChatReader } from './chat-read-scope'
import type { StructuredQueryInputs } from './chat-tool-structured-query'
import type {
  DynamicRecordCondition,
  DynamicRecordReadScope,
} from '@/application/ports/repositories/tables/dynamic-record-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'

/**
 * Who a tool's lookups are judged for ({@link ChatReader}): the person a
 * declared agent answers, the signed-in caller, or a visitor signed in to
 * nothing (the guest session) — `undefined` for an agent answering no one.
 */
export const chatLinkReader = (reader: ChatReader): LinkReader | undefined => {
  if (reader.answering !== undefined) return chatLinkReader(reader.answering)
  if (reader.userId !== undefined) {
    return {
      session: buildSyntheticSession(reader.userId),
      role: reader.role,
      groups: reader.groups,
    }
  }
  if (reader.agent === true) return undefined
  return { session: buildGuestSession(), role: reader.role, groups: [] }
}

/**
 * What a tool call steers on, in the shape the records list's masks read: the
 * fields its filters name, and its sort.
 */
export const namedByToolCall = (
  conditions: ReadonlyArray<DynamicRecordCondition>,
  sortColumn: string | undefined
): { readonly filter: unknown; readonly sort?: string } => ({
  filter: { and: conditions.map((condition) => ({ field: condition.column })) },
  ...(sortColumn !== undefined && { sort: sortColumn }),
})

/**
 * A `select` widened by what its lookups are judged by — the record's `id`
 * (a many-to-many or reverse lookup is recomputed from its linked rows) and
 * the key column of each lookup it names ({@link lookupKeyColumnsFor}).
 * The rows are narrowed back to the `select` once judged. `undefined` (every
 * column) stays `undefined`.
 */
export const judgedColumns = (
  app: App | undefined,
  tableName: string,
  columns: ReadonlyArray<string> | undefined
): ReadonlyArray<string> | undefined =>
  app === undefined || columns === undefined
    ? columns
    : [...new Set([...columns, 'id', ...lookupKeyColumnsFor(app, tableName, [...columns])])]

/** One tool read: its table, who it answers, and the rows her row rule admits. */
interface ToolRead {
  readonly app: App | undefined
  readonly tableName: string
  readonly reader: ChatReader
  readonly readScope: { readonly readScope?: DynamicRecordReadScope }
}

/** The records list's masks for what a tool call steers on, judged for its person. */
const masksFor = (
  read: ToolRead,
  conditions: ReadonlyArray<DynamicRecordCondition>,
  sortColumn: string | undefined
) =>
  read.app === undefined
    ? Effect.succeed([])
    : lookupReadMasks(
        read.app,
        read.tableName,
        chatLinkReader(read.reader),
        namedByToolCall(conditions, sortColumn)
      )

/**
 * A validated `query_<table>` read, run through the safe parameterized
 * builder, each row handed back as a records read by the same person leaves
 * it: a lookup whose linked record a row-level rule hides from her, and every
 * formula over it, left out ({@link omitHiddenLookups}); a filter or sort on
 * one read as the records list's masks read it ({@link lookupReadMasks}). The
 * read is widened by what the lookups are judged by ({@link judgedColumns}).
 */
export const toolQueryProgram = (read: ToolRead & { readonly inputs: StructuredQueryInputs }) =>
  Effect.gen(function* () {
    const { app, tableName, inputs } = read
    const columns = judgedColumns(app, tableName, inputs.columns)
    const lookupMasks = yield* masksFor(read, inputs.conditions, inputs.sortColumn)
    const rows = yield* listDynamicRecords({
      table: tableName,
      ...(columns !== undefined && { columns }),
      conditions: inputs.conditions,
      ...(inputs.sortColumn !== undefined && { sortColumn: inputs.sortColumn }),
      ...(inputs.sortDirection !== undefined && { sortDirection: inputs.sortDirection }),
      limit: inputs.limit,
      lookupMasks,
      // The reader's row-level read rule, from the records read gate.
      ...read.readScope,
    })
    return yield* omitHiddenLookups(app, tableName, rows, chatLinkReader(read.reader))
  }).pipe(Effect.withSpan('ai.chat.tool-query', { attributes: { 'table.name': read.tableName } }))

/**
 * A validated `count_<table>` read: a filter on a lookup reads it as the
 * records list's masks do for this person, so a count on a guess at a value
 * hidden from her confirms nothing.
 */
export const toolCountProgram = (
  read: ToolRead & { readonly conditions: ReadonlyArray<DynamicRecordCondition> }
) =>
  masksFor(read, read.conditions, undefined).pipe(
    Effect.flatMap((lookupMasks) =>
      countDynamicRecords({
        table: read.tableName,
        conditions: read.conditions,
        lookupMasks,
        ...read.readScope,
      })
    ),
    Effect.withSpan('ai.chat.tool-count', { attributes: { 'table.name': read.tableName } })
  )
