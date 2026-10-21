/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { generateJunctionTableName, junctionKeyColumns } from '../sql/sql-junction-tables'
import { resolveForeignKeyColumn } from './lookup-foreign-key'
import { relationNameOf } from './lookup-view-helpers'
import type { Table } from '@/domain/models/app/tables'

/**
 * Where a `count` / `rollup` reads the linked records of one base row.
 *
 * `from` is the FROM clause (the related relation aliased `alias`, joined
 * through a link table when there is one); `where` holds the conditions that
 * tie the related rows to the base row. The caller appends its own conditions
 * (not trashed, the field's filters) and aggregates over `alias`.
 */
export interface AggregateSource {
  readonly from: string
  readonly where: readonly string[]
}

export interface AggregateSourceInput {
  /** The relationship field the computed field reads through, as config. */
  readonly relationshipFieldDef: Readonly<Record<string, unknown>>
  readonly relationshipFieldName: string
  readonly relatedTable: string
  /** The relation holding the related rows (its view, or its base table for a self-link). */
  readonly relatedRelation: string
  /** The alias the aggregate reads the related rows under. */
  readonly alias: string
  /** The computed field's own name, which names its link-table alias. */
  readonly computedFieldName: string
  /** The alias of the base row (`base`). */
  readonly tableAlias: string
  /** The CONFIG name of the table declaring the computed field. */
  readonly parentTableName: string
  readonly allTables: readonly Table[]
}

/**
 * The FROM clause and join conditions for each direction a relationship can
 * declare:
 *
 * - `many-to-many` keeps no column on either table: its links are rows of the
 *   link table `<parent>_<related>`, the same one a lookup reads. A link
 *   written from either side lands there (a reciprocal write mirrors it into
 *   both link tables), and its composite key holds each pair once, so no
 *   linked record is counted twice.
 * - `one-to-many` keeps the key on the related table: the related row's key
 *   column names the base row.
 * - every other direction (`many-to-one`, `one-to-one`, none declared) keeps
 *   the key on the DECLARING table: the base row's relationship column names
 *   the one linked record, or none.
 *
 * Every identifier goes through `quoteSqlIdentifier`; no value is interpolated.
 */
export const aggregateSourceOf = (input: AggregateSourceInput): AggregateSource => {
  const { relationshipFieldDef, alias, relatedRelation, tableAlias } = input
  const { relationType } = relationshipFieldDef

  if (relationType === 'many-to-many') {
    const parent = sanitizeTableName(input.parentTableName)
    const related = sanitizeTableName(input.relatedTable)
    const junctionAlias = quoteSqlIdentifier(`junction_${input.computedFieldName}`)
    const [parentKey, relatedKey] = junctionKeyColumns(parent, related)
    return {
      from: `${relationNameOf(generateJunctionTableName(parent, related))} AS ${junctionAlias}
     INNER JOIN ${relatedRelation} AS ${alias} ON ${alias}.id = ${junctionAlias}.${quoteSqlIdentifier(relatedKey)}`,
      where: [`${junctionAlias}.${quoteSqlIdentifier(parentKey)} = ${tableAlias}.id`],
    }
  }

  if (relationType === 'one-to-many') {
    const foreignKeyColumn = resolveForeignKeyColumn(
      relationshipFieldDef,
      input.relationshipFieldName,
      input.parentTableName,
      input.allTables
    )
    return {
      from: `${relatedRelation} AS ${alias}`,
      where: [`${alias}.${quoteSqlIdentifier(foreignKeyColumn)} = ${tableAlias}.id`],
    }
  }

  return {
    from: `${relatedRelation} AS ${alias}`,
    where: [`${alias}.id = ${tableAlias}.${quoteSqlIdentifier(input.relationshipFieldName)}`],
  }
}
