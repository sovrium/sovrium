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
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { getManyToManyFieldSpecs, type ManyToManyFieldSpec } from './many-to-many-fields'
import {
  buildRecordDisplayLabels,
  collectReferencedKeys,
  getRelationshipDisplaySpecs,
} from './relationship-display-fields'
import type { TransformedRecord } from './record-transformer'
import type { DatabaseError } from '@/domain/errors'
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
  fields?: string
): Effect.Effect<ManyToManyLinkMap, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const specs = selectedManyToManySpecs(app, tableName, fields)
    if (specs.length === 0 || ids.length === 0) return {}
    const repo = yield* TableRepository
    return yield* repo.readManyToMany({
      sourceTable: tableName,
      sourceIds: ids,
      fields: specs.map((s) => ({ fieldName: s.fieldName, relatedTable: s.relatedTable })),
    })
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
  return links ? { ...fields, ...links } : { ...fields }
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

/** Enrich a page of records with their many-to-many field values from junctions. */
export const enrichRecordsWithManyToMany = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[],
  fields?: string
): Effect.Effect<readonly TransformedRecord[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const linkMap = yield* readManyToManyLinks(
      app,
      tableName,
      records.map((r) => r.id),
      fields
    )
    return records.map(
      (record) =>
        ({
          ...record,
          fields: mergeManyToManyFields(record.fields, record.id, linkMap),
        }) as TransformedRecord
    )
  }).pipe(Effect.withSpan('tables.enrich-records-with-many-to-many'))

/**
 * Attach the `_display` label block to a page of records.
 *
 * Runs AFTER the many-to-many enrich, because a many-to-many column has no base
 * column — its keys only exist on the record once the junction has been read,
 * and a to-many relationship is exactly the case a read surface most needs
 * labelled.
 *
 * The stored keys are untouched: `_display` sits beside `fields`, so a caller
 * that wants the identifier still finds it where it always was.
 */
export const enrichRecordsWithRelatedLabels = (
  app: App | undefined,
  tableName: string,
  records: readonly TransformedRecord[]
): Effect.Effect<readonly TransformedRecord[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const specs = getRelationshipDisplaySpecs(app?.tables, tableName)
    if (specs.length === 0 || records.length === 0) return records
    const requests = collectReferencedKeys(specs, records)
    if (requests.length === 0) return records
    const repo = yield* TableRepository
    const labels = yield* repo.readRelatedLabels(requests)
    return records.map((record) => {
      const display = buildRecordDisplayLabels(specs, record.fields, labels)
      return (display ? { ...record, _display: display } : record) as TransformedRecord
    })
  }).pipe(Effect.withSpan('tables.enrich-records-with-related-labels'))
