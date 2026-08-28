/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { isAutomationOperationallyEnabled } from '@/domain/utils/automation-operational-state'
import { logError } from '@/infrastructure/logging/logger'
import { buildSyntheticSession } from './build-guest-session'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import { evaluateRecordTriggerCondition } from './record-trigger-filters'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/**
 * Inputs to the record-event trigger.
 *
 * `record` is the freshly created/updated/deleted row, surfaced to actions
 * via `{{trigger.data.record.X}}`. Specs reference the row's `id` to update
 * it back ({{trigger.data.record.id}}), and the row's other fields when
 * conditional logic depends on the new value.
 *
 * `previousRecord` is only meaningful for `update` events. It is used to
 * narrow update-event triggers via the `watchFields` config (only fire when
 * one of the listed fields actually changed). Pass undefined for create/
 * delete events.
 */
export interface TriggerRecordEventInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord?: Record<string, unknown>
  /**
   * Process env captured at the route boundary. Threaded through to
   * `executeAutomationRun` so action handlers can resolve `$env.VAR_NAME`
   * references and so secrets get redacted from run-history. Mirrors the
   * pattern used by `runWebhookAutomation` and `runManualAutomation` —
   * keeps this use case free of `process.env` reads inside the application
   * layer.
   */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** The user who triggered the record event (creator/updater). */
  readonly userId?: string
}

/**
 * Return true if at least one of `watchFields` differs between the
 * pre-update and post-update record. Used to suppress update-event triggers
 * whose `watchFields` config narrows them to specific columns.
 *
 * No `previousRecord` (e.g. create/delete events, or upstream skipped the
 * pre-fetch) means we cannot diff — falls open to "trigger fires" so
 * create/delete behaviour is unchanged.
 */
const watchFieldsChanged = (
  watchFields: readonly string[],
  record: Readonly<Record<string, unknown>>,
  previousRecord: Readonly<Record<string, unknown>> | undefined
): boolean => {
  if (previousRecord === undefined) return true
  return watchFields.some((field) => {
    const before = previousRecord[field]
    const after = record[field]
    // Compare with !== first (handles primitives) and fall back to
    // JSON.stringify for object-valued fields. The watchFields use case
    // here is single-line scalar fields (status, priority) so the JSON
    // path is a pragmatic safety net, not a deep-equality contract.
    if (before === after) return false
    return JSON.stringify(before) !== JSON.stringify(after)
  })
}

interface RecordEventMatchInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
  readonly pausedNames: ReadonlySet<string>
}

/**
 * Filter app.automations down to record-triggered automations whose trigger
 * config matches the (tableName, event) tuple AND, for `update` events,
 * passes `watchFields`/`condition` gates if configured. Automations that are
 * OFF — config-disabled OR operationally paused — are excluded, so an operator
 * can stop a misbehaving workflow without editing config or uninstalling.
 */
const findMatchingRecordAutomations = (
  input: RecordEventMatchInput
): readonly NonNullable<App['automations']>[number][] => {
  const { app, tableName, event, record, previousRecord, pausedNames } = input
  return (app.automations ?? []).filter((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    if (!trigger.events.includes(event)) return false
    // watchFields narrows update events to specific columns. Create/delete
    // ignore watchFields per the schema convention (the column "doesn't
    // exist before/after" semantics are undefined).
    if (
      event === 'update' &&
      trigger.watchFields !== undefined &&
      !watchFieldsChanged(trigger.watchFields, record, previousRecord)
    ) {
      return false
    }
    // condition filters by record content. Evaluated against a context
    // exposing the new record at both `record.X` and `trigger.data.record.X`
    // so spec authors can pick the more readable variant.
    if (
      trigger.condition !== undefined &&
      !evaluateRecordTriggerCondition(trigger.condition, record)
    ) {
      return false
    }
    return true
  })
}

/**
 * Names of the single-user (`allowMultiple !== true`) `user`-typed fields
 * declared on the named table. GAP-20 scopes hydration to single-user fields
 * — multi-user (`allowMultiple: true`) fields are intentionally left as the
 * raw id list (NOT full relationship hydration).
 */
const singleUserFieldNames = (app: App, tableName: string): readonly string[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter((field): field is typeof field & { readonly allowMultiple?: boolean } => {
      if (field.type !== 'user') return false
      // Scope to single-user fields. A `user` field carries an optional
      // `allowMultiple`; multi-user fields are left as the raw id list
      // (GAP-20 is single-user only — NOT full relationship hydration).
      const { allowMultiple } = field as { readonly allowMultiple?: boolean }
      return allowMultiple !== true
    })
    .map((field) => field.name)
}

/**
 * GAP-20: hydrate single-user `user`-typed fields of the triggering record so
 * `{{trigger.data.record.<userField>.email}}` / `.name` / `.id` resolve to the
 * referenced user rather than the bare id STRING. For each declared single-user
 * field whose record value is a non-empty id, resolve `{ id, email, name }`
 * (via the same `auth.user` lookup the comment trigger uses) and replace the
 * record value with that object. Fields whose user cannot be resolved are left
 * untouched (the raw id remains), so back-compat with the un-hydrated id is
 * preserved on a lookup miss.
 *
 * `getUserMetadataById` keys solely on the `userId` argument and ignores the
 * session payload; the synthetic session only satisfies the repository port's
 * declared `UserSession` shape.
 */
/**
 * Wrap a hydrated column map so template stringification of the FIELD ITSELF
 * ({{...record.plan}} / {{...record.assignee}}) emits the original FK/user id
 * — preserving the pre-hydration contract — while sub-paths
 * ({{...record.plan.tier}}, {{...record.assignee.email}}) keep resolving
 * through the hydrated columns. Handlebars stringifies values via `toString`,
 * so the id lives on the PROTOTYPE (non-enumerable: JSON serialization of the
 * envelope and Object.keys/spread behavior are unaffected).
 */
const withIdToString = (
  columns: Readonly<Record<string, unknown>>,
  id: string
): Readonly<Record<string, unknown>> =>
  Object.assign(Object.create({ toString: () => id }), columns) as Record<string, unknown>

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
 * Generic single-field hydration core shared by the user (GAP-20) and
 * relationship (GAP-J1) hydrators. Both: filter the table's declared fields,
 * resolve each declared field's value to a column map via a repository read,
 * `withIdToString`-wrap it (so the field stringifies as its original id while
 * sub-paths read the hydrated columns), and immutably fold the resolved
 * overlay onto the record. Unresolved fields are omitted from the overlay so
 * their raw id/FK passes through unchanged (back-compat on a lookup miss).
 *
 * `resolveField` returns the `[fieldName, columns]` pair to overlay, or
 * `undefined` to skip (missing/empty value, or a lookup miss). It owns the
 * per-kind value guard and `withIdToString` wrapping because only it knows the
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
        const metaResult = yield* Effect.result(
          comments.getUserMetadataById({ session, userId: value })
        )
        if (metaResult._tag === 'Failure' || !metaResult.success) return undefined
        return [fieldName, withIdToString({ ...metaResult.success }, value)] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

/**
 * Declarations of the single (`allowMultiple !== true`) many-to-one
 * `relationship`-typed fields on the named table, paired with their related
 * table name. GAP-J1 scopes hydration to single many-to-one relationships —
 * multi-relationship (`allowMultiple: true`) fields are left as the raw id
 * list (NOT full hydration), mirroring the GAP-20 single-user scoping.
 */
const singleRelationshipFields = (
  app: App,
  tableName: string
): readonly { readonly field: string; readonly relatedTable: string }[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter(
      (
        field
      ): field is typeof field & {
        readonly relatedTable: string
        readonly relationType?: string
        readonly allowMultiple?: boolean
      } => {
        if (field.type !== 'relationship') return false
        const rel = field as {
          readonly relatedTable?: unknown
          readonly relationType?: string
          readonly allowMultiple?: boolean
        }
        if (typeof rel.relatedTable !== 'string' || rel.relatedTable.length === 0) return false
        // Scope to single many-to-one relationships. `relationType` defaults to
        // 'many-to-one'; only that variant carries a single FK id worth
        // hydrating into the related row. Multi-relationship fields
        // (`allowMultiple: true`) are left as the raw id list.
        if (rel.allowMultiple === true) return false
        const relationType = rel.relationType ?? 'many-to-one'
        return relationType === 'many-to-one'
      }
    )
    .map((field) => ({
      field: field.name,
      relatedTable: (field as { readonly relatedTable: string }).relatedTable,
    }))
}

/**
 * Declarations of the `one-to-many` reverse `relationship` fields on the named
 * table, each paired with the related (child) table name and the reverse FK
 * column on that child table. GAP-J2 surfaces these reciprocal collections onto
 * a GAP-J1-hydrated parent's column map.
 *
 * The reverse FK column is resolved with the same three-branch precedence the
 * lookup-view generator uses (`resolveForeignKeyColumn`): explicit `foreignKey`
 * → `reciprocalField` → the relationship field's own name. For the cloud config
 * (`apps.drains` with `reciprocalField: 'app'`) this yields the `app` column on
 * the `drains` child table.
 */
const reverseCollectionFields = (
  app: App,
  tableName: string
): readonly {
  readonly field: string
  readonly relatedTable: string
  readonly reverseFk: string
}[] => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields
    .filter(
      (
        field
      ): field is typeof field & {
        readonly relatedTable: string
        readonly relationType?: string
        readonly foreignKey?: string
        readonly reciprocalField?: string
      } => {
        if (field.type !== 'relationship') return false
        const rel = field as {
          readonly relatedTable?: unknown
          readonly relationType?: string
        }
        if (typeof rel.relatedTable !== 'string' || rel.relatedTable.length === 0) return false
        // Only the one-to-many reciprocal direction carries a reverse
        // collection. many-to-one fields are the GAP-J1 forward direction.
        return rel.relationType === 'one-to-many'
      }
    )
    .map((field) => {
      const rel = field as {
        readonly name: string
        readonly relatedTable: string
        readonly foreignKey?: string
        readonly reciprocalField?: string
      }
      // Resolve the reverse FK column on the child table, mirroring
      // resolveForeignKeyColumn in lookup-view-generators.ts.
      const reverseFk = rel.foreignKey ?? rel.reciprocalField ?? rel.name
      return { field: rel.name, relatedTable: rel.relatedTable, reverseFk }
    })
}

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
          const rowsResult = yield* Effect.result(
            dataSource.fetchRecords(childTable, {
              filter: [{ field: reverseFk, operator: 'eq', value: parentId }],
            })
          )
          // On a fetch error, omit the collection (leave the raw miss).
          if (rowsResult._tag === 'Failure') return undefined
          // Attach the FIRST reverse row's column map (or `{}` when empty) so
          // `<collection>.<column>` resolves the configured sink in both the
          // Handlebars and legacy resolvers — and survives the JSON round-trip
          // into `trigger_data` that a retry/replay re-reads.
          const collection = firstReverseRowOrEmpty(rowsResult.success)
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
        const rowResult = yield* Effect.result(
          dataSource.fetchSingleRecord(relatedTable, 'id', String(value))
        )
        if (rowResult._tag === 'Failure' || rowResult.success === undefined) return undefined
        // GAP-J2: extend the GAP-J1 column map with the related table's
        // one-to-many reciprocal collections, keyed on reverseFk = parentId.
        const columns = yield* hydrateReverseCollections({
          app,
          relatedTable,
          parentId: String(value),
          columns: rowResult.success,
        })
        return [field, withIdToString(columns, String(value))] as const
      })
    )
    return overlay === undefined ? record : { ...record, ...overlay }
  })

/**
 * Fire all record-triggered automations matching the given event.
 *
 * Matching applies, in order: (table, event) tuple, then `watchFields` for
 * update events (suppress when none of the listed columns changed), then
 * the optional `condition` group (evaluated against the post-mutation
 * record). See `findMatchingRecordAutomations` for the predicate details.
 *
 * Errors are absorbed at the boundary: a record-create endpoint returns 201
 * regardless of automation outcome (the run row records the failure).
 */
export const triggerRecordEventAutomations = (
  input: TriggerRecordEventInput
): Effect.Effect<
  void,
  never,
  | ExecuteAutomationRunRequirements
  | CommentRepository
  | DataSourceRepository
  | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, event, record, previousRecord, processEnv, userId } = input
    // Entry point: one read of the operational pauses per record event.
    const pausedNames = yield* loadPausedAutomationNames
    const matching = findMatchingRecordAutomations({
      app,
      tableName,
      event,
      record,
      previousRecord,
      pausedNames,
    })
    if (matching.length === 0) return

    // GAP-20: hydrate single-user `user`-typed fields so action templates can
    // read `{{trigger.data.record.<userField>.email}}` / `.name` / `.id`.
    const userHydratedRecord = yield* hydrateUserFields({ app, tableName, record, userId })

    // GAP-J1: hydrate single many-to-one `relationship` fields so action
    // templates can read `{{trigger.data.record.<rel>.<column>}}` (the related
    // row's columns) rather than the bare FK id.
    const hydratedRecord = yield* hydrateRelationshipFields({
      app,
      tableName,
      record: userHydratedRecord,
    })

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData: { record: hydratedRecord } as unknown as TriggerData,
          userId,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[automation:record-event] dispatch failure', cause)
      })
    )
  )
