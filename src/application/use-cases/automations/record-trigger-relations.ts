/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Declarations of the single (`allowMultiple !== true`) many-to-one
 * `relationship`-typed fields on the named table, paired with their related
 * table name. GAP-J1 scopes hydration to single many-to-one relationships —
 * multi-relationship (`allowMultiple: true`) fields are left as the raw id
 * list (NOT full hydration), mirroring the [internal ref] single-user scoping.
 */
export const singleRelationshipFields = (
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
export const reverseCollectionFields = (
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
