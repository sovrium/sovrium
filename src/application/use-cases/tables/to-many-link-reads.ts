/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read of the to-many fields a base-table row cannot carry: many-to-many
 * ids from the junction tables, and one-to-many ids — the rows of another table
 * pointing here through their `reciprocalField`. Both come back as one link
 * map, narrowed to the linked rows the reader may read, which the list and the
 * single-record reads merge into each record's `fields`.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { DatabaseError } from '@/domain/errors'
import { toManyLinksRefusedTo } from '@/domain/models/app/tables/related-field-read-service'
import { filterReadableLinks, relatedReaderOf, type LinkReader } from './linked-row-visibility'
import {
  getManyToManyFieldSpecs,
  linkReadOf,
  getOneToManyFieldSpecs,
  type ManyToManyFieldSpec,
  type OneToManyFieldSpec,
} from './many-to-many-fields'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/** The link map `recordId -> fieldName -> relatedIds` (records with no links absent). */
export type ManyToManyLinkMap = Record<string, Record<string, readonly (string | number)[]>>

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

/** The one-to-many fields a read should resolve, honouring a `?fields=` selection. */
const selectedOneToManySpecs = (
  app: App | undefined,
  tableName: string,
  fields: string | undefined
): readonly OneToManyFieldSpec[] => {
  const specs = getOneToManyFieldSpecs(app?.tables, tableName)
  if (fields === undefined) return specs
  const requested = new Set(fields.split(',').map((name) => name.trim()))
  return specs.filter((spec) => requested.has(spec.fieldName))
}

/**
 * `specs` less the links the reader may not read at all — into a table that
 * refuses them, or withheld by a field rule ({@link toManyLinksRefusedTo}).
 * Such a link is never read, so it is absent from the record rather than an
 * empty list. With no reader every declared link is read.
 */
function readableSpecs<S extends { readonly fieldName: string }>(
  app: App | undefined,
  tableName: string,
  specs: readonly S[],
  reader: LinkReader | undefined
): readonly S[] {
  if (app === undefined || reader === undefined || specs.length === 0) return specs
  const refused = toManyLinksRefusedTo(app, tableName, relatedReaderOf(reader))
  return refused.size === 0 ? specs : specs.filter((spec) => !refused.has(spec.fieldName))
}

/** The to-many fields a read resolves: selected by `?fields=`, then narrowed to its reader. */
const readableSelection = (
  app: App | undefined,
  tableName: string,
  options: { readonly fields?: string; readonly reader?: LinkReader }
): {
  readonly specs: readonly ManyToManyFieldSpec[]
  readonly reverse: readonly OneToManyFieldSpec[]
} => ({
  specs: readableSpecs(
    app,
    tableName,
    selectedManyToManySpecs(app, tableName, options.fields),
    options.reader
  ),
  reverse: readableSpecs(
    app,
    tableName,
    selectedOneToManySpecs(app, tableName, options.fields),
    options.reader
  ),
})

/** Two link maps as one: a record's fields from both, side by side. */
const mergeLinkMaps = (
  a: Readonly<ManyToManyLinkMap>,
  b: Readonly<ManyToManyLinkMap>
): Readonly<ManyToManyLinkMap> =>
  Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((id) => [id, { ...a[id], ...b[id] }])
  )

/**
 * Resolve the to-many field values a base-table row cannot carry for a set of
 * records: many-to-many ids from the junction tables, and one-to-many ids — the
 * rows of another table pointing here through their `reciprocalField`. No-op
 * (empty map) when the table declares neither, or when a field selection named
 * none of them.
 */
export const readManyToManyLinks = (
  app: App | undefined,
  tableName: string,
  ids: readonly (string | number)[],
  options: { readonly fields?: string; readonly reader?: LinkReader } = {}
): Effect.Effect<
  ManyToManyLinkMap,
  TableReadError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { reader } = options
    const { specs, reverse } = readableSelection(app, tableName, options)
    if ((specs.length === 0 && reverse.length === 0) || ids.length === 0) return {}
    const repo = yield* TableRepository
    const junctionLinks =
      specs.length === 0
        ? {}
        : yield* repo.readManyToMany({
            sourceTable: tableName,
            sourceIds: ids,
            fields: specs.map(linkReadOf),
          })
    const reverseLinks =
      reverse.length === 0
        ? {}
        : yield* (yield* DataSourceRepository)
            .fetchOneToManyLinks({ sourceIds: ids, fields: reverse })
            .pipe(
              Effect.mapError(
                (error) => new DatabaseError('Failed to read one-to-many links', error.cause)
              )
            )
    // A reader sees only the linked rows the related table lets them read.
    const readable = yield* filterReadableLinks(
      app,
      [...specs, ...reverse],
      mergeLinkMaps(junctionLinks, reverseLinks),
      reader
    )
    return readable as ManyToManyLinkMap
  }).pipe(Effect.withSpan('tables.read-many-to-many-links'))

/**
 * The many-to-many lists a write named, read after it for `reader`: what the
 * write's answer shows of them, as `GET /records/:recordId` would. Empty when
 * the write named none.
 */
export const readWrittenLinkLists = (
  app: App | undefined,
  tableName: string,
  recordId: string,
  options: {
    readonly written: Readonly<Record<string, unknown>>
    readonly reader: LinkReader | undefined
  }
): Effect.Effect<
  ManyToManyLinkMap,
  TableReadError,
  TableRepository | DataSourceRepository | AuthRepository
> => {
  const named = getManyToManyFieldSpecs(app?.tables, tableName)
    .map((spec) => spec.fieldName)
    .filter((name) => Object.hasOwn(options.written, name))
  if (named.length === 0) return Effect.succeed({})
  const { reader } = options
  return readManyToManyLinks(app, tableName, [recordId], {
    fields: named.join(','),
    ...(reader === undefined ? {} : { reader }),
  }).pipe(Effect.withSpan('tables.read-written-link-lists'))
}
