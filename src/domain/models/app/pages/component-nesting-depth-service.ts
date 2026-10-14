/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How deeply a config nests its components, and whether a decode that reports
 * every mistake can afford to run over it.
 *
 * WHY A DEPTH DECIDES THE DECODE. A page item is a component OR a reference to
 * a template, and the reference has four forms, each holding `children`. When
 * a component fails, the decoder tries the four reference forms too, and with
 * `errors: 'all'` each form walks the SAME `children` again before giving up.
 * So every failing ancestor multiplies the work by five: a mistake eight
 * containers deep costs seconds, fourteen deep never finishes. Only the
 * reported residue differs between the walks, and the report keeps the
 * component's own complaint, so the walks buy nothing an author reads.
 *
 * Deeper than {@link FULL_REPORT_MAX_DEPTH}, the decode stops at the first
 * mistake instead: the same refusal, with the same message, in bounded time.
 * The depth is an upper bound, counted over every object naming a `type`, a
 * `component` or a `$ref`, so it may err towards the bounded decode, never
 * away from it.
 */

/** The deepest nesting a decode reporting every mistake still finishes quickly over. */
export const FULL_REPORT_MAX_DEPTH = 7

/** Does this object open a level the decoder's item union is tried at? */
const opensLevel = (node: Readonly<Record<string, unknown>>): boolean =>
  typeof node['type'] === 'string' ||
  typeof node['component'] === 'string' ||
  typeof node['$ref'] === 'string'

/**
 * The most component-like objects found nested inside one another, on any
 * path through the value. Arrays add no level; a component inside one does.
 */
export const componentNestingDepth = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.reduce<number>(
      (deepest, item) => Math.max(deepest, componentNestingDepth(item)),
      0
    )
  }
  if (typeof value !== 'object' || value === null) return 0
  const node = value as Readonly<Record<string, unknown>>
  const inner = Object.values(node).reduce<number>(
    (deepest, child) => Math.max(deepest, componentNestingDepth(child)),
    0
  )
  return inner + (opensLevel(node) ? 1 : 0)
}

/** Can a decode reporting every mistake run over this config in bounded time? */
export const canReportEveryDecodeMistake = (parsed: unknown): boolean =>
  componentNestingDepth(parsed) <= FULL_REPORT_MAX_DEPTH
