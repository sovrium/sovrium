/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withEffectivePrimaryKey } from '@/domain/models/app/tables/record-id-service'
import {
  LIVE_ROWS_PREDICATE,
  REFERENCED_KEY_COLUMNS,
  type TableWithReferencedKeys,
} from '../sql/sql-key-constraints'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

/**
 * [internal ref] (file-uploads): Upgrade single-attachment columns referenced by
 * any top-level form to storeMetadata true so the column type becomes
 * JSONB (via mapFieldTypeToPostgres special case). This makes the column
 * accept the canonical url/name/size/mimeType payload the form submit
 * pipeline writes, without forcing schema authors to repeat
 * storeMetadata true on every column they expose through a form.
 *
 * The set key is tableName::columnName so an attachment column on one
 * table is not auto-upgraded just because another table happens to have
 * the same column name.
 *
 * Also resolved INTO the schema snapshot (`migration-audit-trail.ts`): a form
 * that starts referencing an attachment column changes how that column is
 * stored, so it must change the checksum too, or a form-only deploy would take
 * the fast path and the column would stay `VARCHAR` while the form writes
 * metadata objects into it. For an app with no such form the upgrade is a
 * no-op, so its checksum — and every snapshot an older binary wrote — is
 * unchanged.
 */
export const upgradeFormReferencedAttachments = (
  tables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => {
  const referenced = new Set<string>(
    (app.forms ?? []).flatMap((form) => {
      const tableName = form.submitTo.table
      if (typeof tableName !== 'string') return []
      return form.fields
        .filter(
          (f): f is typeof f & { readonly kind: 'table-field'; readonly column: string } =>
            f.kind === 'table-field'
        )
        .map((f) => tableName + '::' + f.column)
    })
  )
  if (referenced.size === 0) return tables
  return tables.map((t) => {
    const fields = t.fields.map((f) => {
      if (f.type !== 'single-attachment') return f
      if (!referenced.has(t.name + '::' + f.name)) return f
      const hasFlag =
        'storeMetadata' in f && (f as { storeMetadata?: boolean }).storeMetadata === true
      if (hasFlag) return f
      return { ...f, storeMetadata: true } as typeof f
    })
    return { ...t, fields } as Table
  })
}

/** The column lists the `foreignKeys` entries reference, by referenced config table name. */
type ReferencedKeys = ReadonlyMap<string, readonly (readonly string[])[]>

const referencedKeysOf = (tables: readonly Table[]): ReferencedKeys => {
  const entries = tables.flatMap((t) => t.foreignKeys ?? [])
  const grouped = Map.groupBy(entries, (entry) => entry.referencedTable)
  return new Map(
    [...grouped].map(([name, keys]) => [name, keys.map((key) => key.referencedFields)])
  )
}

/** Whether a `foreignKeys` entry references exactly `columns` of `tableName`, in any order. */
const isReferencedKey = (
  references: ReferencedKeys,
  tableName: string,
  columns: readonly string[]
): boolean =>
  (references.get(tableName) ?? []).some(
    (key) => key.length === columns.length && key.every((column) => columns.includes(column))
  )

/**
 * Mark on each table the unique columns a `foreignKeys` entry references on
 * their own (`REFERENCED_KEY_COLUMNS`): such a field keeps a table-level
 * `UNIQUE` over every row instead of the live-rows index, because neither engine
 * accepts a reference to a partial index.
 */
const markReferencedKeyColumns = (
  tables: readonly Table[],
  references: ReferencedKeys
): readonly Table[] =>
  tables.map((t) => {
    const columns = (references.get(t.name) ?? []).flatMap((key) =>
      key.length === 1 && key[0] !== undefined ? [key[0]] : []
    )
    if (columns.length === 0) return t
    const marked: TableWithReferencedKeys = { ...t, [REFERENCED_KEY_COLUMNS]: columns }
    return marked
  })

/**
 * the pages access publishing requirement (slug-management): Normalize the table-
 * level `unique: [{ fields: [...] }]` sugar into the existing primitives
 * so constraint-sync and index-sync handle persistence without a new
 * code path:
 *
 *   - single-field entry → set `field.unique = true` on the matching
 *     field (idempotent — leaves an already-unique field alone).
 *   - multi-field entry → append a unique btree index to `table.indexes`
 *     under a deterministic name (`uq_<table>_<f1>_<f2>__<i>`), over live
 *     records only (`WHERE deleted_at IS NULL`), like a single-field `unique` —
 *     unless a `foreignKeys` entry references those columns: a reference needs a
 *     key unique over every row, so that index keeps no `WHERE`.
 *
 * Unknown field names are silently dropped — they would have failed
 * upstream Effect Schema validation if the author meant a real column.
 */
const normalizeTopLevelUnique = (
  tables: readonly Table[],
  references: ReferencedKeys
): readonly Table[] =>
  tables.map((t) => {
    const uniqueGroups = (
      t as Table & { readonly unique?: ReadonlyArray<{ readonly fields: ReadonlyArray<string> }> }
    ).unique
    if (!uniqueGroups || uniqueGroups.length === 0) return t

    const knownFieldNames = new Set(t.fields.map((f) => f.name))
    const groups = uniqueGroups.filter((g) => g.fields.every((name) => knownFieldNames.has(name)))
    if (groups.length === 0) return t

    const singleFieldNames = new Set(
      groups.filter((g) => g.fields.length === 1).map((g) => g.fields[0]!)
    )
    const newFields = t.fields.map((f) =>
      singleFieldNames.has(f.name) && !('unique' in f && f.unique)
        ? ({ ...f, unique: true } as typeof f)
        : f
    )

    const compositeGroups = groups.filter((g) => g.fields.length > 1)
    const compositeIndexes = compositeGroups.map((g, idx) => ({
      name: `uq_${t.name}_${g.fields.join('_')}__${idx}`.slice(0, 60),
      fields: g.fields,
      unique: true,
      ...(isReferencedKey(references, t.name, g.fields) ? {} : { where: LIVE_ROWS_PREDICATE }),
    }))
    const mergedIndexes =
      compositeIndexes.length === 0 ? t.indexes : [...(t.indexes ?? []), ...compositeIndexes]

    return {
      ...t,
      fields: newFields,
      ...(mergedIndexes ? { indexes: mergedIndexes } : {}),
    } as Table
  })

/**
 * The uniqueness half of {@link applySchemaDefaults}: top-level `unique` sugar
 * flattened, and the keys a `foreignKeys` entry references marked. Exported for
 * the boot fast path, which compares the catalog with the config's tables
 * before any other default applies, and must read uniqueness exactly as the
 * migration writes it — or a top-level `unique` read as no uniqueness at all,
 * and the boot took the full migration every time.
 */
export const applyUniqueDefaults = (tables: readonly Table[]): readonly Table[] => {
  const references = referencedKeysOf(tables)
  return markReferencedKeyColumns(normalizeTopLevelUnique(tables, references), references)
}

/**
 * `tables` with the text key a table in `auth.scopeTables` is created with when
 * it declares none (`withEffectivePrimaryKey`). Exported for the boot fast
 * path, whose check of the installed views must compare them with the views
 * the migration writes — over a text key, not the serial key the config
 * literally implies — or every boot read them as stale.
 */
export const withScopeTableKeys = (
  tables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => tables.map((t) => withEffectivePrimaryKey(t, app.auth?.scopeTables))

/**
 * Apply schema-author-friendly defaults to the sorted table list:
 *   - Z-1/Z-2: tables in `auth.scopeTables` get a TEXT primary key when
 *     none was declared, so applications can store portable string IDs
 *     in `user_access.record_ids`.
 * - [internal ref]: form-referenced `single-attachment` columns get
 *     `storeMetadata: true` so the column type becomes JSONB and accepts
 *     the canonical `{ url, name, size, mimeType }` metadata produced by
 *     the form-submit pipeline.
 *   - Pages-002: top-level `unique: [{ fields: [...] }]` flattens into
 *     field-level `unique: true` (single field) or composite unique
 *     indexes so existing migration paths apply without modification.
 *   - A unique key some `foreignKeys` entry references stays unique over
 *     every row, trash included (see {@link markReferencedKeyColumns}).
 */
export const applySchemaDefaults = (
  sortedTables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => {
  const withScopePk = withScopeTableKeys(sortedTables, app)
  const withFormAttachments = upgradeFormReferencedAttachments(withScopePk, app)
  return applyUniqueDefaults(withFormAttachments)
}
