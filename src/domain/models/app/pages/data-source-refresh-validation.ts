/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-config validation of `dataSource.refreshMode` on rows the server draws.
 *
 * `refreshMode` sits on the SHARED data source schema, so every data-bound
 * component decodes it, while only the components drawn in the browser can
 * follow a change. Two draw their rows on the server and run no script for
 * them, so a `refreshMode` there would be accepted and do nothing:
 *
 *  - a `container` with a `dataSource`, repeating its children per record;
 *  - a `list` drawing its rows from `children` rather than
 *    `listDisplay.itemTemplate`.
 *
 * Both are refused, naming `listDisplay.itemTemplate` as the live way to draw
 * the same rows. `refreshMode: 'none'` is the default spelled out, and passes.
 * A list in `search` or `single` mode, or with neither `children` nor an item
 * template, is not refused: it ignores the key, like the other data components
 * that do not follow it yet. Runs inside `decodeAppConfigObject`, so `validate`,
 * `start` and `build` reach the same verdict.
 */

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

/** The way to draw server-drawn rows so they follow their table. */
const LIVE_ALTERNATIVE =
  'draw the rows as a list with listDisplay.itemTemplate to have them follow their table, or remove refreshMode'

/** Why ONE typed node's binding cannot refresh, or `undefined` when it can (or declares nothing). */
const serverDrawnReason = (node: Readonly<Record<string, unknown>>): string | undefined => {
  if (node['type'] === 'container')
    return 'a container with a dataSource draws its rows on the server'
  if (node['type'] !== 'list') return undefined
  // Search and single mode are bindings of their own, drawn by the search list
  // and the record detail — the same split as `isListIslandMode`.
  const { mode } = node['dataSource'] as Readonly<Record<string, unknown>>
  if (mode === 'search' || mode === 'single') return undefined
  const display = isRecord(node['listDisplay']) ? node['listDisplay'] : undefined
  const { children } = node
  return display?.['itemTemplate'] === undefined && Array.isArray(children) && children.length > 0
    ? 'a list drawing its rows from children draws them on the server'
    : undefined
}

/** The refusal for one node, if it declares a refreshMode it cannot honour. */
const checkNode = (node: Readonly<Record<string, unknown>>, path: string): readonly string[] => {
  const { dataSource } = node
  if (!isRecord(dataSource)) return []
  const mode = dataSource['refreshMode']
  if (mode === undefined || mode === 'none') return []
  const reason = serverDrawnReason(node)
  return reason === undefined
    ? []
    : [
        `${path}.dataSource.refreshMode: ${reason}, so nothing can refresh them — ${LIVE_ALTERNATIVE}`,
      ]
}

const walk = (node: unknown, path: string): readonly string[] => {
  if (Array.isArray(node))
    return node.flatMap((element, index) => walk(element, `${path}[${index}]`))
  if (!isRecord(node)) return []
  return [
    ...(typeof node['type'] === 'string' ? checkNode(node, path) : []),
    ...Object.entries(node).flatMap(([key, value]) =>
      walk(value, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/** Report every `dataSource.refreshMode` declared on rows the server draws. */
export function validateDataSourceRefreshModes(config: unknown): readonly string[] {
  return walk(isRecord(config) ? config['pages'] : undefined, 'pages')
}
