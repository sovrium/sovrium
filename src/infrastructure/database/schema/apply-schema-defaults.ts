/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'

/**
 * F-11 (file-uploads): Upgrade single-attachment columns referenced by
 * any top-level form to storeMetadata true so the column type becomes
 * JSONB (via mapFieldTypeToPostgres special case). This makes the column
 * accept the canonical url/name/size/mimeType payload the form submit
 * pipeline writes, without forcing schema authors to repeat
 * storeMetadata true on every column they expose through a form.
 *
 * The set key is tableName::columnName so an attachment column on one
 * table is not auto-upgraded just because another table happens to have
 * the same column name.
 */
const upgradeFormReferencedAttachments = (
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

/**
 * [internal ref] (slug-management): Normalize the table-
 * level `unique: [{ fields: [...] }]` sugar into the existing primitives
 * so constraint-sync and index-sync handle persistence without a new
 * code path:
 *
 *   - single-field entry → set `field.unique = true` on the matching
 *     field (idempotent — leaves an already-unique field alone).
 *   - multi-field entry → append a unique btree index to `table.indexes`
 *     under a deterministic name (`uq_<table>_<f1>_<f2>__<i>`).
 *
 * Unknown field names are silently dropped — they would have failed
 * upstream Effect Schema validation if the author meant a real column.
 */
const normalizeTopLevelUnique = (tables: readonly Table[]): readonly Table[] =>
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
 * Apply schema-author-friendly defaults to the sorted table list:
 *   - Z-1/Z-2: tables in `auth.scopeTables` get a TEXT primary key when
 *     none was declared, so applications can store portable string IDs
 *     in `user_access.record_ids`.
 *   - F-11: form-referenced `single-attachment` columns get
 *     `storeMetadata: true` so the column type becomes JSONB and accepts
 *     the canonical `{ url, name, size, mimeType }` metadata produced by
 *     the form-submit pipeline.
 *   - Pages-002: top-level `unique: [{ fields: [...] }]` flattens into
 *     field-level `unique: true` (single field) or composite unique
 *     indexes so existing migration paths apply without modification.
 */
export const applySchemaDefaults = (
  sortedTables: readonly Table[],
  app: Readonly<App>
): readonly Table[] => {
  const scopeTableNames = new Set(app.auth?.scopeTables ?? [])
  const withScopePk = sortedTables.map((t) =>
    scopeTableNames.has(t.name) && t.primaryKey === undefined
      ? ({ ...t, primaryKey: { type: 'text', field: 'id' } } as Table)
      : t
  )
  const withFormAttachments = upgradeFormReferencedAttachments(withScopePk, app)
  return normalizeTopLevelUnique(withFormAttachments)
}
