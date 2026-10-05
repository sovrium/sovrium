/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * [internal ref]: the many-to-many family — the write split, the junction read, and
 * the related-label enrichment every record-bearing response shares.
 *
 * A `many-to-many` relationship field has NO base column. That one fact is why
 * this module exists and why every program in the package needs a piece of it:
 * a write must split the field OUT of the INSERT/UPDATE (it would name a
 * phantom column and 500) and put its ids in the junction table instead; a read
 * must put them BACK, because `SELECT *` never returned them.
 *
 * The three consumers take three different slices, which is what makes this a
 * module rather than a section of one:
 *
 *   - `write-record-programs.ts`  — {@link splitManyToManyFields} + {@link writeManyToManyLinks}
 *   - `read-record-programs.ts`   — {@link readManyToManyLinks} + {@link mergeManyToManyFields}
 *   - `list-records-program.ts`   — {@link enrichRecordsWithManyToMany} + {@link enrichRecordsWithRelatedLabels}
 *
 * The related-label enrichment sits here rather than beside the list program
 * because it MUST run after the junction read — a to-many column's keys only
 * exist on the record once the junction has been read, and a to-many
 * relationship is exactly the case a read surface most needs labelled. Keeping
 * the two in one file keeps that ordering a local fact instead of a convention
 * two modules have to remember.
 *
 * ## The four spans are new, and they are the point
 * Each Effect-returning export here opens one. They were private to a
 * 1,043-line file before the split, so `Effect Span Census` could not see them
 * and the list program's single span covered all three of their repository
 * calls as one opaque block — which is precisely the "a trace shows the shape
 * of a request and nothing about where its time went" the gate exists to end.
 * These are the grid's per-page fan-out reads: a junction SELECT, a
 * related-label SELECT, and a junction INSERT. They are the queries a slow list
 * response is most likely to be waiting on, and they are now visible as such.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { DatabaseError } from '@/domain/errors'
import { filterReadableLinks, readableKeys, type LinkReader } from './linked-row-visibility'
import { getManyToManyFieldSpecs, type ManyToManyFieldSpec } from './many-to-many-fields'
import {
  buildRecordDisplayLabels,
  buildUserDisplayLabels,
  collectReferencedKeys,
  collectReferencedUserIds,
  getRelationshipDisplaySpecs,
  getUserDisplayFieldNames,
  type LabelReader,
  type RecordDisplayLabels,
  type RequestedLabel,
} from './relationship-display-fields'
import type { TransformedRecord } from './record-transformer'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'

type ManyToManyWriteLink = {
  readonly relatedTable: string
  readonly relatedIds: readonly (string | number)[]
  readonly hasReciprocal: boolean
}

/** The junction map `recordId -> fieldName -> relatedIds` (records with no links absent). */
type ManyToManyLinkMap = Record<string, Record<string, readonly (string | number)[]>>

/**
 * Split a create payload into base-column fields and many-to-many write links.
 * A many-to-many field has no base column, so it must be removed from the
 * INSERT and its ids written to the junction table instead.
 */
export const splitManyToManyFields = (
  fields: Readonly<Record<string, unknown>>,
  specs: readonly ManyToManyFieldSpec[]
): {
  readonly baseFields: Record<string, unknown>
  readonly links: readonly ManyToManyWriteLink[]
} => {
  const names = new Set(specs.map((s) => s.fieldName))
  const baseFields = Object.fromEntries(Object.entries(fields).filter(([key]) => !names.has(key)))
  const links = specs
    .map((spec) => {
      const raw = fields[spec.fieldName]
      const relatedIds =
        raw === undefined || raw === null
          ? []
          : Array.isArray(raw)
            ? (raw as (string | number)[])
            : [raw as string | number]
      return { relatedTable: spec.relatedTable, relatedIds, hasReciprocal: spec.hasReciprocal }
    })
    .filter((link) => link.relatedIds.length > 0)
  return { baseFields, links }
}

/**
 * The many-to-many fields a read should resolve, honouring a `?fields=`
 * selection.
 *
 * A many-to-many column has no base column, so it survives `applyFieldSelection`
 * by not being there at all and is then re-injected from the table's DECLARED
 * specs. Left unfiltered that is a selection bypass: `?fields=title` came back
 * carrying `tags` because the enrichment never consulted the requested list.
 *
 * The intersection runs only when a selection is present — an absent `fields`
 * still means "every column", junction-backed ones included.
 */
const selectedManyToManySpecs = (
  app: App | undefined,
  tableName: string,
  fields: string | undefined
): readonly ManyToManyFieldSpec[] => {
  const specs = getManyToManyFieldSpecs(app?.tables, tableName)
  if (fields === undefined) return specs
  const requested = new Set(fields.split(',').map((name) => name.trim()))
  return specs.filter((spec) => requested.has(spec.fieldName))
}

/**
 * Resolve many-to-many field values from junction tables for a set of records.
 * No-op (empty map) when the table declares no many-to-many fields, or when a
 * field selection named none of them.
 */
export const readManyToManyLinks = (
  app: App | undefined,
  tableName: string,
  ids: readonly (string | number)[],
  options: { readonly fields?: string; readonly reader?: LinkReader } = {}
): Effect.Effect<
  ManyToManyLinkMap,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const specs = selectedManyToManySpecs(app, tableName, options.fields)
    if (specs.length === 0 || ids.length === 0) return {}
    const repo = yield* TableRepository
    const links = yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: ids,
      fields: specs.map((s) => ({ fieldName: s.fieldName, relatedTable: s.relatedTable })),
    })
    // A reader sees only the linked rows the related table lets them read.
    const readable = yield* filterReadableLinks(app, specs, links, options.reader)
    return readable as ManyToManyLinkMap
  }).pipe(Effect.withSpan('tables.read-many-to-many-links'))

/**
 * Merge a record's resolved many-to-many arrays into its `fields` (no-op when
 * absent). Generic in the field value type `V` so the merge preserves the
 * caller's value typing instead of collapsing to `unknown`; the injected
 * many-to-many values are `readonly (string | number)[]` (a subtype of the
 * response field-value union), so the result stays assignable to it.
 *
 * A `function` declaration rather than the generic ARROW it was, and the
 * spelling is load-bearing rather than taste. `[internal ref]`
 * parses every file as `ScriptKind.TSX`, where `<V>(` opens a JSX element
 * instead of a type-parameter list: the arrow form produced 309 parse
 * diagnostics and lost 34 of this file's 57 statements, so `Effect Span Census`
 * saw ZERO of the nine spanned exports the package publishes and reported the
 * whole of `programs.ts` as absent rather than as uncovered. `function f<V>(`
 * is unambiguous under BOTH script kinds. The parser's own TSX assumption is a
 * separate finding routed to `[internal ref]`; this spelling is what
 * makes the census see this package at all in the meantime.
 */
export function mergeManyToManyFields<V>(
  fields: Readonly<Record<string, V>>,
  recordId: string | number,
  linkMap: Readonly<ManyToManyLinkMap>
): Readonly<Record<string, V | readonly (string | number)[]>> {
  const links = linkMap[String(recordId)]
  // Each linked id reads as a string, as every record id does.
  return links
    ? {
        ...fields,
        ...Object.fromEntries(
          Object.entries(links).map(([field, ids]) => [field, ids.map(String)] as const)
        ),
      }
    : { ...fields }
}

/** Write a create's many-to-many junction rows (no-op when there are none). */
export const writeManyToManyLinks = (
  repo: TableRepository['Service'],
  tableName: string,
  sourceId: string | number,
  links: readonly ManyToManyWriteLink[]
): Effect.Effect<void, DatabaseError> =>
  (links.length === 0
    ? Effect.void
    : repo.linkManyToMany({ sourceTable: tableName, sourceId, links })
  ).pipe(Effect.withSpan('tables.write-many-to-many-links'))

/**
 * The many-to-many fields an update CLEARS: present in the change as `null` or
 * as an empty list. Any other value keeps its add-only meaning — the links it
 * names are added, none are removed.
 */
export const clearedManyToManySpecs = (
  fields: Readonly<Record<string, unknown>>,
  specs: readonly ManyToManyFieldSpec[]
): readonly ManyToManyFieldSpec[] =>
  specs.filter((spec) => {
    if (!Object.hasOwn(fields, spec.fieldName)) return false
    const value = fields[spec.fieldName]
    return value === null || (Array.isArray(value) && value.length === 0)
  })

/**
 * Remove every link of the cleared fields that the writer may read. A link to
 * a row the related table hides from the writer is kept: they never saw it, so
 * clearing the field cannot mean it. A writer with no reader identity (an
 * automation) clears every link.
 */
export const clearManyToManyLinks = (input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly recordId: string | number
  readonly cleared: readonly ManyToManyFieldSpec[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<void, DatabaseError, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const { app, tableName, recordId, cleared, reader } = input
    if (cleared.length === 0) return
    const repo = yield* TableRepository
    const stored = yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: [recordId],
      fields: cleared.map((s) => ({ fieldName: s.fieldName, relatedTable: s.relatedTable })),
    })
    const readable = yield* filterReadableLinks(app, cleared, stored, reader)
    const lists = readable[String(recordId)] ?? {}
    yield* repo.unlinkManyToMany({
      sourceTable: tableName,
      sourceId: recordId,
      links: cleared.map((spec) => ({
        relatedTable: spec.relatedTable,
        relatedIds: lists[spec.fieldName] ?? [],
        hasReciprocal: spec.hasReciprocal,
      })),
    })
  }).pipe(Effect.withSpan('tables.clear-many-to-many-links'))

/** Enrich a page of records with their many-to-many field values from junctions. */
export const enrichRecordsWithManyToMany = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  options: { readonly fields?: string; readonly reader?: LinkReader } = {}
): Effect.Effect<
  readonly TransformedRecord[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const linkMap = yield* readManyToManyLinks(
      app,
      tableName,
      records.map((r) => r.id),
      options
    )
    return records.map(
      (record) =>
        ({
          ...record,
          fields: mergeManyToManyFields(record.fields, record.id, linkMap),
        }) as TransformedRecord
    )
  }).pipe(Effect.withSpan('tables.enrich-records-with-many-to-many'))

/** Who a page's labels are resolved for, and which ones the request asked for. */
interface LabelAudience {
  readonly reader: LabelReader
  readonly requested?: readonly RequestedLabel[]
  /**
   * The reader as a session, so a related ROW they may not read is not named:
   * its key stays on the record — it is the record's own value — but its label
   * is never looked up. Absent, only the table and field grants narrow.
   */
  readonly linkReader?: LinkReader
}

type LabelRequest = ReturnType<typeof collectReferencedKeys>[number]

/** Each label request narrowed to the related rows the reader may read. */
const readableLabelRequests = (
  app: App | undefined,
  requests: readonly LabelRequest[],
  linkReader: LinkReader | undefined
): Effect.Effect<
  readonly LabelRequest[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.forEach(requests, (request) => {
    const related = app?.tables?.find((t) => t.name === request.relatedTable)
    if (app === undefined || related === undefined || linkReader === undefined) {
      return Effect.succeed(request)
    }
    return readableKeys(app, related, request.ids.map(String), linkReader).pipe(
      Effect.map((readable) =>
        readable === undefined
          ? request
          : { ...request, ids: request.ids.filter((id) => readable.has(String(id))) }
      )
    )
  }).pipe(
    Effect.map((narrowed) => narrowed.filter((request) => request.ids.length > 0)),
    Effect.withSpan('tables.readable-label-requests')
  )

/** The relationship part of each record's labels, keyed by record id (empty when none). */
const readRelationshipLabels = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  audience: LabelAudience
): Effect.Effect<
  ReadonlyMap<string, RecordDisplayLabels>,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const specs = getRelationshipDisplaySpecs(app, tableName, audience.reader, audience.requested)
    const collected = specs.length === 0 ? [] : collectReferencedKeys(specs, records)
    const requests = yield* readableLabelRequests(app, collected, audience.linkReader)
    if (requests.length === 0) return new Map<string, RecordDisplayLabels>()
    const repo = yield* TableRepository
    const labels = yield* repo.readRelatedLabels(requests)
    return new Map(
      records.flatMap((record) => {
        const display = buildRecordDisplayLabels(specs, record.fields, labels)
        return display ? [[String(record.id), display] as const] : []
      })
    )
  })

/**
 * The user-field part of each record's labels: the account's name, or
 * its email when it has none, for every `user` / `created-by` / `updated-by` /
 * `deleted-by` value on the page — read in ONE query through the auth
 * repository, never from the user table directly.
 */
const readUserLabels = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[]
): Effect.Effect<ReadonlyMap<string, RecordDisplayLabels>, DatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const fieldNames = getUserDisplayFieldNames(app, tableName)
    const ids = fieldNames.length === 0 ? [] : collectReferencedUserIds(fieldNames, records)
    if (ids.length === 0) return new Map<string, RecordDisplayLabels>()
    const auth = yield* AuthRepository
    const labels = yield* auth
      .getUserDisplayLabels(ids)
      .pipe(
        Effect.mapError((error) => new DatabaseError('Failed to read account labels', error.cause))
      )
    return new Map(
      records.flatMap((record) => {
        const display = buildUserDisplayLabels(fieldNames, record.fields, labels)
        return display ? [[String(record.id), display] as const] : []
      })
    )
  })

/**
 * Attach the `_display` label block to a page of records: the label of every
 * relationship key whose field declared one, and the name of every account a
 * user field stores.
 *
 * Runs AFTER the many-to-many enrich, because a many-to-many column has no base
 * column — its keys only exist on the record once the junction has been read,
 * and a to-many relationship is exactly the case a read surface most needs
 * labelled.
 *
 * The stored keys are untouched: `_display` sits beside `fields`, so a caller
 * that wants the identifier still finds it where it always was.
 *
 * `audience.reader` is required rather than optional: every label is a value of
 * another table, and resolving one without knowing who will read it is how an
 * admin-only column reached viewers one hop away. `audience.requested` carries the
 * `?labels=` pairs a page column asked for.
 */
export const enrichRecordsWithRelatedLabels = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  audience: LabelAudience
): Effect.Effect<
  readonly TransformedRecord[],
  DatabaseError,
  TableRepository | AuthRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    if (records.length === 0) return records
    const [related, users] = yield* Effect.all(
      [
        readRelationshipLabels(app, tableName, records, audience),
        readUserLabels(app, tableName, records),
      ],
      { concurrency: 1 }
    )
    if (related.size === 0 && users.size === 0) return records
    return records.map((record) => {
      const key = String(record.id)
      const display = { ...related.get(key), ...users.get(key) }
      return (
        Object.keys(display).length > 0 ? { ...record, _display: display } : record
      ) as TransformedRecord
    })
  }).pipe(Effect.withSpan('tables.enrich-records-with-related-labels'))
