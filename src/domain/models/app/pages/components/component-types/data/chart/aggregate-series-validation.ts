/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Decode rule for `series` under `chartAggregate`.
 *
 * A chart that aggregates draws ONE value per group, so `series` may hold one
 * entry, which styles that value — its `label` names it, its `color` paints
 * the marks. A second entry has nothing to draw: it is refused at boot,
 * naming `series` and `chartAggregate`, rather than rendering an empty chart.
 *
 * Runs over the RAW config at the shared decode boundary, so boot,
 * `sovrium validate` and a watch reload reach the same verdict. Pure.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object at any depth. */
function collectNodes(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectNodes)
  if (!isRecord(node)) return []
  return [node, ...Object.values(node).flatMap(collectNodes)]
}

/** The refusal for one chart, or `undefined`. */
function aggregateSeriesViolation(node: RawRecord): string | undefined {
  if (node['type'] !== 'chart' || !isRecord(node['chartAggregate'])) return undefined
  const { series } = node
  if (!Array.isArray(series) || series.length <= 1) return undefined
  return `chart: \`series\` declares ${String(series.length)} entries under \`chartAggregate\`, which draws one aggregated value per group. Keep one entry — its \`label\` and \`color\` style that value — or remove \`chartAggregate\` to plot each series' own field.`
}

/**
 * Refuse a chart declaring more than one series under `chartAggregate`.
 *
 * @returns one message per offending chart, empty otherwise
 */
export function validateAggregateSeries(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  return collectNodes(pages).flatMap((node) => {
    const message = aggregateSeriesViolation(node)
    return message === undefined ? [] : [message]
  })
}
