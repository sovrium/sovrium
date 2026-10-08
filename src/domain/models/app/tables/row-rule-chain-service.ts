/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row rule that reads one relationship deep: `<relationship>.<column>`.
 *
 * A child table is often scoped by its parent — the deployments of the apps I
 * created, the invoices of my clients' projects. A row rule names that with a
 * chain: `app_ref.created_by` reads `created_by` on the row `app_ref` points to.
 * The relationship is a many-to-one one of the ruled table, and the column one
 * of the related table: one hop, no recursion.
 *
 * Every door answers the hop the same way, by the RELATED ROWS the leaf admits:
 * the related rows whose column satisfies the leaf are looked up once per
 * request, and the ruled row passes when its relationship points at one of
 * them. An empty relationship points at none, so it matches nothing — as an
 * empty field matches no rule. The list asks the same thing in SQL
 * (`<relationship> IN (<ids>)`), so the two never disagree.
 */

import type { RowLevelPredicate, RowLevelWhen } from './row-level-permissions'

/** The two parts of a `<relationship>.<column>` chain. */
export interface RowRuleChain {
  readonly relation: string
  readonly column: string
}

/** A chain the engine follows: the relationship, the table it points to, the column read there. */
export interface ResolvedRowRuleChain extends RowRuleChain {
  readonly relatedTable: string
}

/** The fields of a table, as far as a chain reads them. */
interface ChainField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string
  readonly relationType?: string
  readonly allowMultiple?: boolean
}

interface ChainTable {
  readonly name: string
  readonly fields: ReadonlyArray<ChainField>
}

/** Columns every table holds without declaring them. */
const INTRINSIC_COLUMNS: ReadonlySet<string> = new Set(['id', 'created_at', 'updated_at'])

/** `true` when a rule's `field` is a chain rather than a column of the ruled table. */
export const isRowRuleChain = (field: string): boolean => field.includes('.')

/** The parts of a one-hop chain, or `undefined` for a column or a longer chain. */
export const parseRowRuleChain = (field: string): RowRuleChain | undefined => {
  const parts = field.split('.')
  if (parts.length !== 2) return undefined
  const [relation, column] = parts
  if (relation === undefined || column === undefined || relation === '' || column === '') {
    return undefined
  }
  return { relation, column }
}

/** Why the first part of `chain` is no relationship a row rule can follow, or the field it names. */
const followableRelation = (
  table: ChainTable,
  chain: RowRuleChain
): ChainField | { readonly refusal: string } => {
  const relation = table.fields.find((candidate) => candidate.name === chain.relation)
  if (relation?.type !== 'relationship' || relation.relatedTable === undefined) {
    return {
      refusal: `"${chain.relation}" is not a relationship field of "${table.name}" — a row rule may read a column through one many-to-one relationship`,
    }
  }
  const manyToOne = (relation.relationType ?? 'many-to-one') === 'many-to-one'
  if (!manyToOne || relation.allowMultiple === true) {
    return {
      refusal: `"${chain.relation}" points to many rows — a row rule may read a column through a many-to-one relationship only`,
    }
  }
  return relation
}

/**
 * Follow `field` from `table` through `tables`: the resolved chain, or why it
 * cannot be followed (written for the person who wrote the rule).
 */
export const resolveRowRuleChain = (
  table: ChainTable,
  tables: ReadonlyArray<ChainTable>,
  field: string
): ResolvedRowRuleChain | { readonly refusal: string } => {
  const hops = field.split('.').length - 1
  if (hops > 1) {
    return {
      refusal: `a row rule follows at most one relationship ("<relationship>.<column>"), and "${field}" crosses ${String(hops)}`,
    }
  }
  const chain = parseRowRuleChain(field)
  if (chain === undefined) return { refusal: `"${field}" is not "<relationship>.<column>"` }
  const relation = followableRelation(table, chain)
  if ('refusal' in relation) return relation
  const relatedTable = relation.relatedTable ?? ''
  const related = tables.find((candidate) => candidate.name === relatedTable)
  const columns = new Set([...INTRINSIC_COLUMNS, ...(related?.fields ?? []).map((f) => f.name)])
  if (!columns.has(chain.column)) {
    return {
      refusal: `"${chain.column}" is not a column of "${relatedTable}", the table "${chain.relation}" points to`,
    }
  }
  return { ...chain, relatedTable }
}

/** Every rule leaf (in any branch of a group) whose `field` is a chain. */
export const chainLeavesOf = (when: RowLevelWhen | undefined): readonly RowLevelPredicate[] => {
  if (when === undefined) return []
  if ('conditions' in when && Array.isArray(when.conditions)) {
    return when.conditions.flatMap((child) => chainLeavesOf(child))
  }
  const leaf = when as RowLevelPredicate
  return isRowRuleChain(leaf.field) ? [leaf] : []
}

/**
 * The key a leaf's answer is kept under: the same chain, operator and value
 * always admit the same related rows for one reader.
 */
export const chainLeafKey = (leaf: RowLevelPredicate): string =>
  JSON.stringify([leaf.field, leaf.operator, leaf.value])
