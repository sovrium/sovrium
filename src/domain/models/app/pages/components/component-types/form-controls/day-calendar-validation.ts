/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `calendar`'s `defaultValue` takes the shape its `mode` picks: one ISO date
 * for `single`, `{ from, to }` for `range`, a list for `multiple`. The two keys
 * are siblings, and the component branch has no refinement hook, so the pair is
 * checked here, at the shared decode boundary, naming both keys. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The shape a mode expects, in the words of the message. */
const EXPECTED: Readonly<Record<string, readonly [(value: unknown) => boolean, string]>> = {
  single: [(value) => typeof value === 'string', 'one ISO date, for example 2026-10-14'],
  range: [isRecord, '`{ from, to }`, for example { from: 2026-10-19, to: 2026-10-23 }'],
  multiple: [Array.isArray, 'a list of ISO dates'],
}

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) =>
      collectNodes(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/**
 * Every calendar whose `defaultValue` does not take the shape of its `mode`.
 *
 * @returns one message per mismatch
 */
export function validateDayCalendarDefaults(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  return collectNodes(pages, 'pages')
    .filter(([node]) => node['type'] === 'calendar' && node['defaultValue'] !== undefined)
    .flatMap(([node, path]) => {
      const mode = typeof node['mode'] === 'string' ? node['mode'] : 'single'
      const expected = EXPECTED[mode]
      if (expected === undefined || expected[0](node['defaultValue'])) return []
      return [
        `${path}: a calendar in \`mode: ${mode}\` takes a \`defaultValue\` of ${expected[1]}. Write the default in that shape, or change \`mode\` to the one it was written for.`,
      ]
    })
}
