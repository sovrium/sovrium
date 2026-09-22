/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRelationshipForeignKey } from '@/domain/models/app/tables/relationship-foreign-key'
import type { Table } from '@/domain/models/app/tables'

/**
 * Adapt a relationship field definition to the pure domain foreign-key resolver.
 *
 * The view generators hold relationship fields as loosely-typed records (the
 * union of every field type erases the relationship-only properties), so the
 * narrowing lives here rather than in the domain, which stays free of any
 * knowledge of how the SQL layer happens to carry its config.
 *
 * Routing through the shared resolver is what keeps the SQL emitted here and the
 * config accepted at startup from drifting apart: the startup validator refuses
 * exactly the shapes this cannot answer.
 */

const readString = (source: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The child-side foreign-key column a `rollup` / `count` subquery joins on.
 *
 * An unresolvable one-to-many (no candidate, or several) falls back to the
 * relationship field's own name. Startup validation has already refused such a
 * config, so this path is unreachable in a booted app, and throwing from inside
 * a SQL string builder would turn a config error into a crash far from its
 * cause.
 */
export const resolveForeignKeyColumn = (
  relationshipFieldDef: Readonly<Record<string, unknown>>,
  relationshipFieldName: string,
  parentTableName: string,
  allTables: readonly Table[]
): string => {
  const relatedTable = readString(relationshipFieldDef, 'relatedTable')

  const resolution = resolveRelationshipForeignKey({
    relationshipField: {
      name: relationshipFieldName,
      relatedTable,
      relationType: readString(relationshipFieldDef, 'relationType'),
      foreignKey: readString(relationshipFieldDef, 'foreignKey'),
      reciprocalField: readString(relationshipFieldDef, 'reciprocalField'),
    },
    parentTableName,
    childTable: allTables.find((t) => t.name === relatedTable),
  })

  return resolution.resolved ? resolution.column : relationshipFieldName
}
