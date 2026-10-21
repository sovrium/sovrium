/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rollup tables: a source's aggregation → a Sovrium rollup aggregation.
 *
 * A rollup carries no formula text to translate: it is a relation, a field of
 * the linked table, and one aggregation. The relation and the field come from
 * the field's options; the aggregation is read through the source's row here.
 *
 * - Notion states it, as the rollup's `function`; Baserow as its
 *   `rollup_function`.
 * - Airtable does not: its API returns the result type and the two field ids,
 *   never the aggregation formula (`SUM(values)`). A rollup whose options do
 *   state one (an export that carries the formula) is read through the table;
 *   any other Airtable rollup keeps its last values, and the report says why.
 *
 * A row that is not `mapped` keeps the field as a column of its last values.
 */

import { toolDisplayName } from './source-display-name-service'
import type { TableSourceTool } from './field-type-mappings'

/** The aggregations a Sovrium rollup accepts. */
export type SovriumRollupAggregation =
  'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'COUNTA' | 'COUNTALL' | 'ARRAYUNIQUE'

/** One row of a rollup table. */
export type RollupAggregationMapping =
  | {
      readonly source: string
      readonly outcome: 'mapped'
      readonly aggregation: SovriumRollupAggregation
      /** What differs at the edges, when something does. */
      readonly note?: string
    }
  | {
      readonly source: string
      readonly outcome: 'degraded' | 'unsupported'
      readonly reason: string
    }

const mapped = (
  source: string,
  aggregation: SovriumRollupAggregation,
  note?: string
): RollupAggregationMapping => ({
  source,
  outcome: 'mapped',
  aggregation,
  ...(note === undefined ? {} : { note }),
})

const unsupported = (source: string, reason: string): RollupAggregationMapping => ({
  source,
  outcome: 'unsupported',
  reason,
})

const NO_TEXT_AGGREGATION = 'A Sovrium rollup does not join or combine the linked values as text'
const NO_LOGICAL_AGGREGATION = 'A Sovrium rollup does not combine true/false values'
const NO_SHARE = 'A Sovrium rollup counts and aggregates; it does not compute shares or groups'

/** Airtable's rollup aggregation functions, as the rollup field configuration lists them. */
const AIRTABLE: readonly RollupAggregationMapping[] = [
  mapped('SUM', 'SUM'),
  mapped('AVERAGE', 'AVG'),
  mapped('MIN', 'MIN'),
  mapped('MAX', 'MAX'),
  mapped('COUNT', 'COUNT'),
  mapped('COUNTA', 'COUNTA'),
  mapped('COUNTALL', 'COUNTALL'),
  mapped('ARRAYUNIQUE', 'ARRAYUNIQUE'),
  unsupported('AND', NO_LOGICAL_AGGREGATION),
  unsupported('OR', NO_LOGICAL_AGGREGATION),
  unsupported('XOR', NO_LOGICAL_AGGREGATION),
  unsupported('CONCATENATE', NO_TEXT_AGGREGATION),
  unsupported('ARRAYJOIN', NO_TEXT_AGGREGATION),
  unsupported('ARRAYCOMPACT', NO_TEXT_AGGREGATION),
]

/** Notion's rollup `function` values, as its API lists them. */
const NOTION: readonly RollupAggregationMapping[] = [
  mapped('sum', 'SUM'),
  mapped('average', 'AVG'),
  mapped('min', 'MIN'),
  mapped('max', 'MAX'),
  mapped('earliest_date', 'MIN'),
  mapped('latest_date', 'MAX'),
  mapped('count', 'COUNTALL'),
  mapped(
    'count_values',
    'COUNTA',
    'Notion counts each value of a multi-value property; Sovrium counts each linked record that has one'
  ),
  mapped('show_unique', 'ARRAYUNIQUE'),
  unsupported(
    'show_original',
    'A Sovrium rollup aggregates; a lookup field lists the original values'
  ),
  unsupported('unique', 'A Sovrium rollup does not count distinct values'),
  unsupported('empty', 'A Sovrium rollup does not count empty values'),
  unsupported('not_empty', 'A Sovrium rollup does not count non-empty values as a share'),
  unsupported('median', 'A Sovrium rollup has no median'),
  unsupported('range', 'A Sovrium rollup has no range'),
  unsupported('date_range', 'A Sovrium rollup has no date range'),
  unsupported('checked', NO_LOGICAL_AGGREGATION),
  unsupported('unchecked', NO_LOGICAL_AGGREGATION),
  unsupported('percent_empty', NO_SHARE),
  unsupported('percent_not_empty', NO_SHARE),
  unsupported('percent_checked', NO_SHARE),
  unsupported('percent_unchecked', NO_SHARE),
  unsupported('count_per_group', NO_SHARE),
  unsupported('percent_per_group', NO_SHARE),
]

/** Baserow's `rollup_function` values, the aggregate formula functions a rollup offers. */
const BASEROW: readonly RollupAggregationMapping[] = [
  mapped('sum', 'SUM'),
  mapped('avg', 'AVG'),
  mapped('min', 'MIN'),
  mapped('max', 'MAX'),
  mapped(
    'count',
    'COUNTA',
    'Baserow counts each linked value; Sovrium counts each linked record that has one'
  ),
  unsupported('every', NO_LOGICAL_AGGREGATION),
  unsupported('any', NO_LOGICAL_AGGREGATION),
  unsupported('join', NO_TEXT_AGGREGATION),
  unsupported('stddev_pop', 'A Sovrium rollup has no standard deviation'),
  unsupported('stddev_sample', 'A Sovrium rollup has no standard deviation'),
  unsupported('variance_pop', 'A Sovrium rollup has no variance'),
  unsupported('variance_sample', 'A Sovrium rollup has no variance'),
]

/** The rollup tables of the sources whose rollups this importer reads. */
export const ROLLUP_AGGREGATION_MAPPINGS: Readonly<
  Partial<Record<TableSourceTool, readonly RollupAggregationMapping[]>>
> = { airtable: AIRTABLE, notion: NOTION, baserow: BASEROW }

/** `SUM(values)`: the aggregation formula an Airtable rollup is configured with. */
const AIRTABLE_ROLLUP_FORMULA = /^\s*([A-Za-z]+)\s*\(\s*values\s*\)\s*$/

/** The aggregation a rollup's options state, in the source's own words. */
const statedAggregation = (
  tool: TableSourceTool,
  options: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  if (tool === 'notion' || tool === 'baserow') {
    const named = options?.[tool === 'notion' ? 'function' : 'rollup_function']
    return typeof named === 'string' ? named : undefined
  }
  const formula = options?.['formula']
  if (typeof formula !== 'string') return undefined
  return AIRTABLE_ROLLUP_FORMULA.exec(formula)?.[1]?.toUpperCase()
}

/**
 * The Sovrium aggregation of one rollup, read from its options.
 *
 * `unsupported` when the source does not state the aggregation (an Airtable
 * rollup from its API) or states one no row maps.
 */
export const inferRollupAggregation = (
  tool: TableSourceTool,
  options: Readonly<Record<string, unknown>> | undefined
): RollupAggregationMapping => {
  const table = ROLLUP_AGGREGATION_MAPPINGS[tool]
  if (table === undefined) {
    return unsupported('', `Rollups from ${toolDisplayName(tool)} are not converted yet`)
  }
  const stated = statedAggregation(tool, options)
  if (stated === undefined) {
    return unsupported(
      '',
      tool === 'airtable'
        ? "Airtable's API does not expose a rollup's aggregation, so it cannot be rebuilt"
        : 'The rollup states no aggregation'
    )
  }
  return (
    table.find((row) => row.source === stated) ??
    unsupported(stated, `The rollup aggregation "${stated}" has no Sovrium counterpart`)
  )
}

/** How many rows of a source's rollup table land on each outcome. */
export const rollupCoverage = (
  tool: TableSourceTool
): Readonly<Record<RollupAggregationMapping['outcome'], number>> =>
  (ROLLUP_AGGREGATION_MAPPINGS[tool] ?? []).reduce(
    (counts, row) => ({ ...counts, [row.outcome]: counts[row.outcome] + 1 }),
    { mapped: 0, degraded: 0, unsupported: 0 }
  )
