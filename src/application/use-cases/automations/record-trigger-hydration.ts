/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { getManyToManyFieldSpecs } from '@/application/use-cases/tables/many-to-many-fields'
import { storedRowOf } from '@/application/use-cases/tables/record-stored-row'
import { transformRecord } from '@/application/use-cases/tables/record-transformer'
import { readManyToManyLinks } from '@/application/use-cases/tables/to-many-link-reads'
import { logError } from '@/infrastructure/logging/logger'
import { buildSyntheticSession } from './build-guest-session'
import { singleUserFieldNames, withHydratedId } from './hydrated-field-reference'
import { reverseCollectionFields, singleRelationshipFields } from './record-trigger-relations'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/**
 * [internal ref]: hydrate single-user `user`-typed fields of the triggering record so
 * `{{trigger.data.record.<userField>.email}}` / `.name` / `.id` resolve to the referenced user
 * rather than the bare id STRING. For each declared single-user field whose record value is a
 * non-empty id, resolve `{ id, email, name }` (via the same `auth.user` lookup the comment trigger
 * uses) and replace the record value with that object. Fields whose user cannot be resolved are
 * left untouched (the raw id remains), so back-compat with the un-hydrated id is preserved on a
 * lookup miss.
 *
 * `getUserMetadataById` keys solely on the `userId` argument and ignores the session payload; the
 * synthetic session only satisfies the repository port's declared `UserSession` shape.
 */
/**
 * GAP-J2 reverse-collection value: the FIRST reverse row's column map (a plain
 * object), or `{}` when the collection is empty. The cloud app provisions
 * exactly ONE reverse drain per app, so the only template access in the field
 * — `{{...record.<rel>.<reverseCollection>.<column>}}` — collapses to that
 * single row's column. Resolving to the first row's PLAIN object (rather than a
 * clever Array-that-also-carries-its-first-row's-own-props hybrid) keeps the
 * value:
 *
 *   - resolvable by both engines: Handlebars `a.b.c` and the legacy
 *     `lookupPath` reducer both read an own property of a plain object;
 *   - JSON-round-trip safe: the envelope is persisted into
 *     `system.automation_runs.trigger_data` and re-read verbatim on RETRY/replay
 *     (`replayAutomationRun` → `coerceTriggerData`). A hybrid array would lose
 *     its `Object.assign`ed own props on `JSON.stringify` (arrays serialize only
 *     indices), so a replayed two-hop chain would silently resolve to the empty
 *     string. A plain object's own props survive the round-trip.
 *
 * An empty collection yields `{}`, so a `.column` access resolves to the empty
 * string (back-compat with the un-hydrated miss). The full LIST form
 * (`{{...record.<rel>.<reverseCollection>}}` terminating on a list) is YAGNI:
 * no spec references it and the single-sink cloud config never needs it.
 */
const firstReverseRowOrEmpty = (
  rows: readonly Record<string, unknown>[]
): Readonly<Record<string, unknown>> => rows[0] ?? {}

/**
 * A row read from the database, as the records API reads it — and as the
 * triggering row already is: a checkbox is `true`/`false` on both engines (not
 * SQLite's `1`/`0`), a date is its day, an id and a relationship value strings.
 */
const asRecordsApiRow = (
  app: App,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => storedRowOf(transformRecord(row, { app, tableName }))

/**
 * Log a failed hydration read with its cause, before the hydrator falls back
 * to the raw value: the trigger still dispatches, and the miss is traced.
 */
const logHydrationFailure =
  (read: string, context: Readonly<Record<string, string>>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError(
            `[automation:record-event] ${read} could not be read; leaving the raw value`,
            cause,
            context
          )
        )
      )
    )

/**
 * Generic single-field hydration core shared by the user and
 * relationship (GAP-J1) hydrators. Both: filter the table's declared fields,
 * resolve each declared field's value to a column map via a repository read,
 * `withHydratedId`-wrap it (so the field stringifies as its original id while
 * sub-paths read the hydrated columns), and immutably fold the resolved
 * overlay onto the record. Unresolved fields are omitted from the overlay so
 * their raw id/FK passes through unchanged (back-compat on a lookup miss).
 *
 * `resolveField` returns the `[fieldName, columns]` pair to overlay, or
 * `undefined` to skip (missing/empty value, or a lookup miss). It owns the
 * per-kind value guard and `withHydratedId` wrapping because only it knows the
 * id used for the prototype `toString`.
 */
const hydrateFields = <Field, R>(
  fields: readonly Field[],
  resolveField: (
    field: Field
  ) => Effect.Effect<readonly [string, Record<string, unknown>] | undefined, never, R>
): Effect.Effect<Record<string, unknown> | undefined, never, R> =>
  Effect.gen(function* () {
    if (fields.length === 0) return undefined
    const resolved = yield* Effect.forEach(fields, resolveField, { concurrency: 1 })
    return Object.fromEntries(
      resolved.filter(
        (entry): entry is readonly [string, Record<string, unknown>] => entry !== undefined
      )
    )
  })

const hydrateUserFields = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Record<string, unknown>
  readonly userId: string | undefined
}): Effect.Effect<Record<string, unknown>, never, CommentRepository> =>
  Effect.gen(function* () {
    const { app, tableName, record, userId } = input
    const fieldNames = singleUserFieldNames(app, tableName)
    if (fieldNames.length === 0) return record

    const comments = yield* CommentRepository
    const session = buildSyntheticSession(userId ?? '')

    // Resolve each single-user field id → user object, then fold the resolved
    // entries into a fresh record immutably (no in-place mutation).
    const overlay = yield* hydrateFields(fieldNames, (fieldName) =>
      Effect.gen(function* () {
        const value = record[fieldName]
        if (typeof value !== 'string' || value.length === 0) return undefined
        // effect-swallow: fail-soft — a user who cannot be read leaves the raw id in the field, as an unknown one does; the cause is logged on the way.
        const metaResult = yield* Effect.result(
          comments
            .getUserMetadataById({ session, userId: value })
            .pipe(logHydrationFailure('user field', { 'sovrium.field.name': fieldName }))
        )
        if (metaResult._tag === 'Failure' || !metaResult.success) return undefined
        return [fieldName, withHydratedId({ ...metaResult.success }, value)] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

/**
 * GAP-J2: extend a GAP-J1-hydrated parent's column map with its REVERSE
 * one-to-many reciprocal collections. For each `one-to-many` `relationship`
 * field declared on the related (parent) table, fetch every child row whose
 * reverse FK equals the parent id and attach the FIRST child's column map
 * (the single configured sink) under the collection field name. An empty
 * collection attaches `{}`, which the template resolver collapses to the empty
 * string on a `.column` access (back-compat with the un-hydrated miss — the
 * action sees no value). See `firstReverseRowOrEmpty` for why the first row is
 * surfaced directly rather than the full list.
 *
 * Exactly ONE level deeper than GAP-J1: the reverse rows' own relationship FKs
 * stay raw (NOT recursively hydrated), and this is applied only to the
 * GAP-J1-hydrated parent column map, never to the top-level triggering record.
 */
const hydrateReverseCollections = (input: {
  readonly app: App
  readonly relatedTable: string
  readonly parentId: string
  readonly columns: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, relatedTable, parentId, columns } = input
    const reverseFields = reverseCollectionFields(app, relatedTable)
    if (reverseFields.length === 0) return columns

    const dataSource = yield* DataSourceRepository
    const overlay = yield* hydrateFields(
      reverseFields,
      ({ field, relatedTable: childTable, reverseFk }) =>
        Effect.gen(function* () {
          // effect-swallow: fail-soft — a collection that cannot be read is omitted from the trigger data; the cause is logged on the way.
          const rowsResult = yield* Effect.result(
            dataSource
              .fetchRecords(childTable, {
                filter: [{ field: reverseFk, operator: 'eq', value: parentId }],
              })
              .pipe(logHydrationFailure('reverse collection', { 'sovrium.table.name': childTable }))
          )
          // On a fetch error, omit the collection (leave the raw miss).
          if (rowsResult._tag === 'Failure') return undefined
          // Attach the FIRST reverse row's column map (or `{}` when empty) so
          // `<collection>.<column>` resolves the configured sink in both the
          // Handlebars and legacy resolvers — and survives the JSON round-trip
          // into `trigger_data` that a retry/replay re-reads.
          const collection = firstReverseRowOrEmpty(
            rowsResult.success.slice(0, 1).map((row) => asRecordsApiRow(app, childTable, row))
          )
          return [field, collection] as const
        })
    )
    return overlay === undefined ? columns : { ...columns, ...overlay }
  })

/**
 * GAP-J1: hydrate single many-to-one `relationship`-typed fields of the
 * triggering record so `{{trigger.data.record.<rel>.<column>}}` resolves a
 * COLUMN of the related row rather than the bare FK id STRING. For each
 * declared single many-to-one field whose record value is a non-empty FK id,
 * fetch the related row by id (via `DataSourceRepository.fetchSingleRecord`,
 * the same read path the page renderer + inline-prefill revalidation use) and
 * replace the FK id with that row's column map ({ id, ...scalar columns }).
 *
 * SINGLE level only — the related row's own relationships are NOT recursively
 * hydrated. Fields whose related row cannot be resolved are left untouched (the
 * raw id remains), preserving back-compat with the un-hydrated FK id on a miss.
 *
 * GAP-J2: before wrapping each related row's column map, it is extended with
 * that related table's one-to-many reciprocal collections (one level deeper —
 * see `hydrateReverseCollections`), so a two-hop chain
 * `{{...record.<rel>.<reverseCollection>.<column>}}` resolves the first reverse
 * row's column.
 */
const hydrateRelationshipFields = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Record<string, unknown>
}): Effect.Effect<Record<string, unknown>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, tableName, record } = input
    const relations = singleRelationshipFields(app, tableName)
    if (relations.length === 0) return record

    const dataSource = yield* DataSourceRepository

    const overlay = yield* hydrateFields(relations, ({ field, relatedTable }) =>
      Effect.gen(function* () {
        const value = record[field]
        if ((typeof value !== 'string' && typeof value !== 'number') || value === '') {
          return undefined
        }
        // effect-swallow: fail-soft — a related record that cannot be read leaves the raw id in the field, as a missing one does; the cause is logged on the way.
        const rowResult = yield* Effect.result(
          dataSource
            .fetchSingleRecord(relatedTable, 'id', String(value))
            .pipe(logHydrationFailure('related record', { 'sovrium.table.name': relatedTable }))
        )
        if (rowResult._tag === 'Failure' || rowResult.success === undefined) return undefined
        // GAP-J2: extend the GAP-J1 column map with the related table's
        // one-to-many reciprocal collections, keyed on reverseFk = parentId.
        const columns = yield* hydrateReverseCollections({
          app,
          relatedTable,
          parentId: String(value),
          columns: { ...asRecordsApiRow(app, relatedTable, rowResult.success) },
        })
        return [field, withHydratedId(columns, String(value))] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

/**
 * The record with each many-to-many field set to its list of linked ids, as
 * strings — what `GET /records/:recordId` answers for it. The links live in the
 * field's link table, never on the row the write hands over, so they are read
 * here, after the write: an update that left the field out still sees the
 * current links, and one that set them sees the new ones. The trigger is the
 * system, not a caller, so every link is read (the admin-only ones are removed
 * later, with the other admin-only fields). A table with no many-to-many field
 * reads nothing; a read that fails leaves the row as it was.
 */
const withManyToManyLinks = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Record<string, unknown>
}): Effect.Effect<
  Record<string, unknown>,
  never,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, record } = input
    const fieldNames = getManyToManyFieldSpecs(app.tables, tableName).map((spec) => spec.fieldName)
    const { id } = record
    if (fieldNames.length === 0 || (typeof id !== 'string' && typeof id !== 'number')) {
      return record
    }
    // effect-swallow: fail-soft — links that cannot be read leave the row as the write handed it over; the cause is logged on the way.
    const linksResult = yield* Effect.result(
      readManyToManyLinks(app, tableName, [id], { fields: fieldNames.join(',') }).pipe(
        logHydrationFailure('many-to-many links', { 'sovrium.table.name': tableName })
      )
    )
    if (linksResult._tag === 'Failure') return record
    const links = linksResult.success[String(id)] ?? {}
    return {
      ...record,
      ...Object.fromEntries(
        fieldNames.map((name) => [name, (links[name] ?? []).map((key) => String(key))] as const)
      ),
    }
  })

/**
 * The pre-update row with its user and relationship fields shaped as the
 * record's are, so `{{trigger.data.previousRecord.<rel>.<column>}}` reads the
 * same way as `{{trigger.data.record.<rel>.<column>}}`. A field the update left
 * unchanged reuses the record's hydrated value instead of being looked up a
 * second time (the hydrators skip a value that is already an object); only a
 * field the update moved costs a lookup of its own.
 */
const hydratePreviousRecord = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Readonly<Record<string, unknown>>
  readonly hydratedRecord: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>>
  readonly userId: string | undefined
}): Effect.Effect<Record<string, unknown>, never, CommentRepository | DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, tableName, record, hydratedRecord, previousRecord, userId } = input
    const hydratable = [
      ...singleUserFieldNames(app, tableName),
      ...singleRelationshipFields(app, tableName).map(({ field }) => field),
    ]
    const unchanged = hydratable
      .filter((field) => previousRecord[field] === record[field])
      .map((field) => [field, hydratedRecord[field]] as const)
    const seeded = { ...previousRecord, ...Object.fromEntries(unchanged) }
    const withUsers = yield* hydrateUserFields({ app, tableName, record: seeded, userId })
    return yield* hydrateRelationshipFields({ app, tableName, record: withUsers })
  })

/**
 * The row after the event, with its many-to-many links, and, on an update, the row before it, both with
 * their user and relationship fields hydrated — every field still in place.
 * What the trigger `condition` reads; the runs receive it without the
 * admin-only fields (`withoutAdminOnlyTriggerFields`).
 */
export const buildRecordTriggerData = (input: {
  readonly app: App
  readonly tableName: string
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord: Readonly<Record<string, unknown>> | undefined
  readonly userId?: string | undefined
}): Effect.Effect<
  {
    readonly record: Record<string, unknown>
    readonly previousRecord?: Record<string, unknown>
  },
  never,
  CommentRepository | DataSourceRepository | TableRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, previousRecord, userId } = input
    // The many-to-many links, read after the write: the row carries none.
    const record = yield* withManyToManyLinks({ app, tableName, record: { ...input.record } })
    // [internal ref]: hydrate single-user `user`-typed fields so action templates can
    // read `{{trigger.data.record.<userField>.email}}` / `.name` / `.id`.
    const userHydratedRecord = yield* hydrateUserFields({
      app,
      tableName,
      record,
      userId,
    })

    // GAP-J1: hydrate single many-to-one `relationship` fields so action
    // templates can read `{{trigger.data.record.<rel>.<column>}}` (the related
    // row's columns) rather than the bare FK id.
    const hydratedRecord = yield* hydrateRelationshipFields({
      app,
      tableName,
      record: userHydratedRecord,
    })

    // The row before an update, shaped the same way. A create or delete has
    // no previous row, and its runs carry no `previousRecord` key at all.
    return previousRecord === undefined
      ? { record: hydratedRecord }
      : {
          record: hydratedRecord,
          previousRecord: yield* hydratePreviousRecord({
            app,
            tableName,
            record,
            hydratedRecord,
            previousRecord,
            userId,
          }),
        }
  }).pipe(Effect.withSpan('automations.build-record-trigger-data'))
