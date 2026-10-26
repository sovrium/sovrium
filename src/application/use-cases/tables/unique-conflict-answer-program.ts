/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a write refused over a taken `unique` value may answer its caller.
 *
 * Gathers the inputs of the pure `decideUniqueCollisionAnswer` — the stored
 * records holding the written values, read without any read rule, each judged
 * by the caller's own row-level read rule — and asks it. Nothing read here is
 * answered to the caller: only whether she could read it.
 *
 * Both transports that write records ask it: the records API
 * (`unique-conflict-mask.ts`) and the agent tools (`mcp/write-calls.ts`). Each
 * passes the judgements only it can make — whether the caller passes the
 * table's read gate, and how the row-level read rule reads a stored row for her.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { recordLanguageOrder } from '@/domain/models/app/tables/translatable-field-service'
import { translatedCondition } from '@/domain/models/app/tables/translatable-query-service'
import {
  isUniqueInEachLanguage,
  languageUniqueView,
  type LanguageUniqueView,
} from '@/domain/models/app/tables/translatable-unique-service'
import {
  collidingFieldsOf,
  decideUniqueCollisionAnswer,
  distinctUniqueFieldSetsOf,
  requestRepeatsUniqueValue,
  uniqueCollisionNeedsHolders,
  uniqueInvolvedFieldsOf,
  uniqueProbesOf,
  writtenOverStored,
  type UniqueCollisionAnswer,
  type UniqueProbe,
} from '@/domain/models/app/tables/unique-collision-visibility-service'
import { logError } from '@/infrastructure/logging/logger'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  TableReadError,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'

/** What a refused write wrote, as far as uniqueness goes. */
export interface UniqueWrite {
  /** The field values of every record the request writes. */
  readonly written: readonly Readonly<Record<string, unknown>>[]
  /**
   * The stored records the request itself addresses (an update, a restore).
   * With one id per written record, `excludeIds[i]` is the record
   * `written[i]` updates, and a uniqueness rule spanning several fields reads
   * the fields the write leaves out from it.
   */
  readonly excludeIds?: readonly string[]
  /**
   * An upsert: each written record updates the live record holding its values
   * of `fields`, unless that record is one of `hiddenIds` (then it creates).
   */
  readonly match?: {
    readonly fields: readonly string[]
    readonly hiddenIds: readonly string[]
  }
}

/** Who made the refused write, as the transport judged her. */
export interface UniqueConflictReader {
  readonly role: string
  readonly groups: readonly string[]
  /** She passes the table's read gate. */
  readonly readsTable: boolean
  /**
   * The row-level read rule as it reads a stored row for her, or `undefined`
   * when no rule narrows what she reads.
   */
  readonly rowReadable: ((row: Readonly<Record<string, unknown>>) => boolean) | undefined
}

/**
 * One probed rule as a filter: a stored record holding every field of one
 * tuple. A translatable unique field's rule is one language's (`slug (fr)`),
 * compared against that language's value of the stored map.
 */
const probeFilterOf =
  (view: LanguageUniqueView) =>
  (probe: UniqueProbe): QueryFilterNode => {
    const [only] = probe.fields
    const language = only === undefined ? undefined : view.targets.get(only)
    const values = probe.tuples.map((tuple) => tuple[0])
    if (probe.fields.length === 1 && language !== undefined) {
      return translatedCondition(language.field, { operator: 'in', value: values }, language.code)
    }
    if (probe.fields.length === 1 && only !== undefined) {
      return { field: only, operator: 'in', value: values }
    }
    return {
      or: probe.tuples.map((tuple) => ({
        and: probe.fields.map((field, index) => ({
          field,
          operator: 'equals',
          value: tuple[index],
        })),
      })),
    }
  }

/** The live records holding one of the probed tuples, less the ones the write addresses. */
const holdersOf = (
  session: Readonly<UserSession>,
  tableName: string,
  lookup: {
    readonly probes: readonly UniqueProbe[]
    readonly excludeIds: readonly string[]
    readonly view: LanguageUniqueView
  }
): Effect.Effect<readonly Record<string, unknown>[], TableReadError, TableRepository> =>
  Effect.gen(function* () {
    const { probes, excludeIds } = lookup
    if (probes.length === 0) return []
    const repo = yield* TableRepository
    const held: QueryFilterNode = { or: probes.map(probeFilterOf(lookup.view)) }
    const others: readonly QueryFilterNode[] =
      excludeIds.length === 0 ? [] : [{ field: 'id', operator: 'notIn', value: excludeIds }]
    return yield* repo.listRecords({ session, tableName, filter: { and: [held, ...others] } })
  })

/** A written record together with the stored record it updates, if any. */
interface AddressedWrite {
  readonly written: Readonly<Record<string, unknown>>
  readonly stored: Readonly<Record<string, unknown>> | undefined
}

/** The live records `ids` names, by id. */
const liveRecordsById = (
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<ReadonlyMap<string, Record<string, unknown>>, TableReadError, TableRepository> =>
  Effect.gen(function* () {
    if (ids.length === 0) return new Map()
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session,
      tableName,
      filter: { and: [{ field: 'id', operator: 'in', value: ids }] },
    })
    return new Map(rows.map((row) => [String(row['id']), row] as const))
  })

/** The live record an upsert's written record updates, if one holds its merge values. */
const upsertMatchOf = (
  session: Readonly<UserSession>,
  tableName: string,
  input: {
    readonly written: Readonly<Record<string, unknown>>
    readonly match: UniqueWrite['match']
  }
): Effect.Effect<Record<string, unknown> | undefined, TableReadError, TableRepository> =>
  Effect.gen(function* () {
    const { written, match } = input
    if (match === undefined || match.fields.length === 0) return undefined
    if (match.fields.some((field) => written[field] === undefined || written[field] === null)) {
      return undefined
    }
    const repo = yield* TableRepository
    const visible: readonly QueryFilterNode[] =
      match.hiddenIds.length === 0
        ? []
        : [{ field: 'id', operator: 'notIn', value: match.hiddenIds }]
    const rows = yield* repo.listRecords({
      session,
      tableName,
      filter: {
        and: [
          ...match.fields.map((field) => ({ field, operator: 'equals', value: written[field] })),
          ...visible,
        ],
      },
    })
    return rows[0]
  })

/** Each written record with the stored record it updates — an update's target, an upsert's match. */
const addressedWritesOf = (
  session: Readonly<UserSession>,
  tableName: string,
  write: UniqueWrite
): Effect.Effect<readonly AddressedWrite[], TableReadError, TableRepository> =>
  Effect.gen(function* () {
    const ids = write.excludeIds ?? []
    const aligned = ids.length === write.written.length
    const byId = aligned ? yield* liveRecordsById(session, tableName, ids) : new Map()
    return yield* Effect.forEach(write.written, (written, index) =>
      Effect.gen(function* () {
        const target = aligned ? byId.get(ids[index]!) : undefined
        const stored =
          target ?? (yield* upsertMatchOf(session, tableName, { written, match: write.match }))
        return { written, stored }
      })
    )
  })

/** The holders a decision needs, with what the write writes, or `undefined` when none is needed. */
const holdersWhenNeeded = (
  input: {
    readonly session: Readonly<UserSession>
    readonly table: Table
    readonly write: UniqueWrite
  },
  view: LanguageUniqueView
): Effect.Effect<
  { readonly probes: readonly UniqueProbe[]; readonly rows: readonly Record<string, unknown>[] },
  TableReadError,
  TableRepository
> =>
  Effect.gen(function* () {
    const { session, table, write } = input
    const addressed = yield* addressedWritesOf(session, table.name, write)
    const { sets, expand } = view
    const probes = uniqueProbesOf(
      sets,
      addressed.map((entry) =>
        writtenOverStored(
          sets,
          expand(entry.written),
          entry.stored === undefined ? undefined : expand(entry.stored)
        )
      )
    )
    const matched = addressed.flatMap((entry) =>
      entry.stored === undefined ? [] : [String(entry.stored['id'])]
    )
    const excludeIds = [...new Set([...(write.excludeIds ?? []), ...matched])]
    const rows = yield* holdersOf(session, table.name, { probes, excludeIds, view })
    return { probes, rows }
  })

/** The table's uniqueness rules, a translatable unique field judged per language (`slug (fr)`). */
const languageViewOf = (app: App, table: Table): LanguageUniqueView =>
  languageUniqueView(
    distinctUniqueFieldSetsOf(table),
    table.fields.filter(isUniqueInEachLanguage).map((field) => field.name),
    recordLanguageOrder(app.languages)
  )

/** Whether `reader` reads a field — a `slug (fr)` label reading as its field. */
const fieldReadableBy =
  (app: App, table: Table, reader: UniqueConflictReader, view: LanguageUniqueView) =>
  (field: string): boolean =>
    isFieldReadableByCaller(
      app,
      table.name,
      { role: reader.role, groups: reader.groups },
      view.targets.get(field)?.field ?? field
    )

/** The answer `reader` gets for a write to `table` refused over a taken unique value. */
export const uniqueConflictAnswerProgram = (input: {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly table: Table
  readonly write: UniqueWrite
  readonly reader: UniqueConflictReader
}): Effect.Effect<UniqueCollisionAnswer, never, TableRepository> =>
  Effect.gen(function* () {
    const { app, table, write, reader } = input
    const view = languageViewOf(app, table)
    const fieldReadable = fieldReadableBy(app, table, reader, view)
    const { sets, expand } = view
    const written = write.written.map(expand)
    const needed = uniqueCollisionNeedsHolders({
      rowScoped: reader.rowReadable !== undefined,
      involvedFields: uniqueInvolvedFieldsOf(table).filter((field) =>
        write.written.some((record) => field in record)
      ),
      fieldReadable,
    })
    const looked = needed
      ? yield* holdersWhenNeeded(input, view).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError(
                '[records] the records holding a refused unique value could not be read',
                cause
              )
            )
          ),
          // effect-swallow: a lookup that fails cannot place the collision, which answers as one that found nothing — the out-of-reach refusal, never the conflict.
          Effect.orElseSucceed(() => ({ probes: [] as readonly UniqueProbe[], rows: [] }))
        )
      : undefined
    const rowReadable = reader.rowReadable ?? (() => true)
    const probes = looked?.probes ?? uniqueProbesOf(sets, written)
    return decideUniqueCollisionAnswer({
      callerReadsEverything: isAdminEquivalent(reader.role, app),
      tableReadable: reader.readsTable,
      probes,
      fieldReadable,
      holders: looked?.rows.map((row) => ({
        rowReadable: rowReadable(row),
        fields: collidingFieldsOf(expand(row), probes),
      })),
      requestRepeats: requestRepeatsUniqueValue(sets, written),
    })
  }).pipe(Effect.withSpan('tables.unique-conflict-answer-program'))

/** The stored rows of `ids`, trashed ones included — what a restore would bring back. */
export const recordsByIdProgram = (input: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly ids: readonly string[]
}): Effect.Effect<readonly Record<string, unknown>[], TableReadError, TableRepository> =>
  Effect.gen(function* () {
    const { session, tableName, ids } = input
    if (ids.length === 0) return []
    const repo = yield* TableRepository
    return yield* repo.listRecords({
      session,
      tableName,
      includeDeleted: true,
      filter: { and: [{ field: 'id', operator: 'in', value: ids }] },
    })
  }).pipe(Effect.withSpan('tables.records-by-id-program'))
