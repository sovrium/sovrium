/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Decode rule for `chartAggregate.fillEmpty`: a window the aggregate read
 * cannot return is refused when the config is read.
 *
 * Every minute of the last seven days is 10 080 buckets, and one aggregate
 * read returns at most {@link FILL_BUCKET_CEILING}. Drawn anyway, the chart
 * would be refused by the read on every page load; refused at boot, the author
 * reads which interval and which range collide. Pure.
 */

import {
  FILL_BUCKET_CEILING,
  FILL_STEP_MS,
  fillBucketCount,
  relativeFillRange,
} from './fill-empty-service'

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
function fillWindowViolation(node: RawRecord): string | undefined {
  const aggregate = node['chartAggregate']
  if (node['type'] !== 'chart' || !isRecord(aggregate) || aggregate['fillEmpty'] !== true) {
    return undefined
  }
  const { interval, groupBy } = aggregate
  const stepMs = typeof interval === 'string' ? FILL_STEP_MS[interval] : undefined
  const source = node['dataSource']
  const range = relativeFillRange(isRecord(source) ? source['filter'] : undefined, String(groupBy))
  if (stepMs === undefined || range === undefined) return undefined
  const buckets = fillBucketCount(range.spanMs, stepMs)
  if (buckets <= FILL_BUCKET_CEILING) return undefined
  return `chart: \`chartAggregate.fillEmpty\` by \`${String(interval)}\` over \`${range.token}\` needs ${String(buckets)} buckets, and one aggregate read returns at most ${String(FILL_BUCKET_CEILING)}. Group by a longer interval or narrow the filter.`
}

/**
 * Refuse a chart whose filled window holds more buckets than one aggregate
 * read returns.
 *
 * @returns one message per offending chart, empty otherwise
 */
export function validateFillEmptyWindows(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  return collectNodes(pages).flatMap((node) => {
    const message = fillWindowViolation(node)
    return message === undefined ? [] : [message]
  })
}
