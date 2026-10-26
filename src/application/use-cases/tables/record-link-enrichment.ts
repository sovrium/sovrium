/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The many-to-many family — the write split, the junction read, and the
 * related-label enrichment every record-bearing response shares.
 *
 * A `many-to-many` relationship field has NO base column. That one fact is why
 * this module exists and why every program in the package needs a piece of it:
 * a write must split the field OUT of the INSERT/UPDATE (it would name a
 * phantom column and 500) and put its ids in the junction table instead; a read
 * must put them BACK, because `SELECT *` never returned them.
 *
 * Three consumers take three slices, which makes this a module, not a section:
 *
 *   - `write-record-programs.ts`  — {@link splitManyToManyFields} + {@link writeManyToManyLinks}
 *   - `read-record-programs.ts`   — {@link mergeManyToManyFields}, over `to-many-link-reads.ts`
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
 * Each Effect-returning export opens one. Private to a 1,043-line file before
 * the split, they were invisible to `Effect Span Census`, and the list span
 * covered their three repository calls as one opaque block — precisely the "a
 * trace shows nothing about where its time went" the gate exists to end.
 * These are the grid's per-page fan-out reads (a junction SELECT, a related-
 * label SELECT, a junction INSERT): what a slow list most likely waits on.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { DatabaseError } from '@/domain/errors'
import { filterReadableLinks, readableKeys, type LinkReader } from './linked-row-visibility'
import { linkReadOf, linkTablesOf, type ManyToManyFieldSpec } from './many-to-many-fields'
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
  withLabelLanguage,
} from './relationship-display-fields'
import { readManyToManyLinks, type ManyToManyLinkMap } from './to-many-link-reads'
import type { TransformedRecord } from './record-transformer'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { RecordLinkWrite } from '@/application/ports/repositories/tables/record-links'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

type ManyToManyWriteLink = RecordLinkWrite

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
      return { relatedTable: spec.relatedTable, relatedIds, ...linkTablesOf(spec) }
    })
    .filter((link) => link.relatedIds.length > 0)
  return { baseFields, links }
}

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

/**
 * The many-to-many fields an update CLEARS: present in the change as `null` or
 * as an empty list. Any other value keeps its add-only meaning — the links it
 * names are added, none are removed.
 */
const clearedManyToManySpecs = (
  fields: Readonly<Record<string, unknown>>,
  specs: readonly ManyToManyFieldSpec[]
): readonly ManyToManyFieldSpec[] =>
  specs.filter((spec) => {
    if (!Object.hasOwn(fields, spec.fieldName)) return false
    const value = fields[spec.fieldName]
    return value === null || (Array.isArray(value) && value.length === 0)
  })

/**
 * The links an update CLEARS: every link of the cleared fields that the writer
 * may read. A link to a row the related table hides from the writer is kept:
 * they never saw it, so clearing the field cannot mean it. A writer with no
 * reader identity (an automation) clears every link.
 *
 * Only READS — the removal is handed to the record write, which applies it in
 * the same transaction as the rest of the change, so a failed update removes
 * nothing.
 */
const linksToClear = (input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly recordId: string | number
  readonly cleared: readonly ManyToManyFieldSpec[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<
  readonly ManyToManyWriteLink[],
  TableReadError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, recordId, cleared, reader } = input
    if (cleared.length === 0) return []
    const repo = yield* TableRepository
    const stored = yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: [recordId],
      fields: cleared.map(linkReadOf),
    })
    const readable = yield* filterReadableLinks(app, cleared, stored, reader)
    const lists = readable[String(recordId)] ?? {}
    return cleared.map((spec) => ({
      relatedTable: spec.relatedTable,
      relatedIds: lists[spec.fieldName] ?? [],
      ...linkTablesOf(spec),
    }))
  }).pipe(Effect.withSpan('tables.links-to-clear'))

/** What an update changes of a record's links, and who it is made for. */
interface LinkChange {
  readonly app?: App | undefined
  readonly tableName: string
  readonly recordId: string | number
  readonly m2mSpecs: readonly ManyToManyFieldSpec[]
  readonly fields: Readonly<Record<string, unknown>>
  readonly reader: LinkReader | undefined
  /** `replace`: a list the change names is the whole set kept (a form posting its picker). */
  readonly linkLists?: 'replace'
}

/**
 * The links an update REMOVES: every readable link of a field it clears
 * ({@link clearedManyToManySpecs}, {@link linksToClear}) and — when its lists
 * REPLACE the links rather than add to them — each named list's readable links
 * the list no longer keeps. A link the writer cannot read is kept either way,
 * and a list's own links are added by the write as in any update.
 */
export const removedLinksOf = (change: LinkChange) => {
  const { app, tableName, recordId, reader, fields } = change
  const listed =
    change.linkLists === 'replace'
      ? change.m2mSpecs.filter((spec) => {
          const value = fields[spec.fieldName]
          return Array.isArray(value) && value.length > 0
        })
      : []
  // Disjoint: a cleared field names no link, a listed one names at least one.
  const touched = [...clearedManyToManySpecs(fields, change.m2mSpecs), ...listed]
  return linksToClear({ app, tableName, recordId, reader, cleared: touched }).pipe(
    // `linksToClear` answers one entry per spec, in order: what the list keeps stays.
    Effect.map((links) =>
      links.map((link, index) => {
        const list = fields[touched[index]?.fieldName ?? '']
        const kept = new Set((Array.isArray(list) ? list : []).map(String))
        return { ...link, relatedIds: link.relatedIds.filter((id) => !kept.has(String(id))) }
      })
    ),
    Effect.withSpan('tables.links-an-update-removes')
  )
}

/** Enrich a page of records with their many-to-many field values from junctions. */
export const enrichRecordsWithManyToMany = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  options: { readonly fields?: string; readonly reader?: LinkReader } = {}
): Effect.Effect<
  readonly TransformedRecord[],
  TableReadError,
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
  /** The reader's language, a label over translatable content is read in. */
  readonly language?: string | undefined
}

type LabelRequest = ReturnType<typeof collectReferencedKeys>[number]

/** Each label request narrowed to the related rows the reader may read. */
const readableLabelRequests = (
  app: App | undefined,
  requests: readonly LabelRequest[],
  linkReader: LinkReader | undefined
): Effect.Effect<
  readonly LabelRequest[],
  TableReadError,
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
  TableReadError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const specs = getRelationshipDisplaySpecs(app, tableName, audience.reader, audience.requested)
    const collected = specs.length === 0 ? [] : collectReferencedKeys(specs, records)
    const requests = yield* readableLabelRequests(app, collected, audience.linkReader)
    if (requests.length === 0) return new Map<string, RecordDisplayLabels>()
    const repo = yield* TableRepository
    const labels = yield* repo.readRelatedLabels(withLabelLanguage(app, requests, audience))
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
  TableReadError,
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
