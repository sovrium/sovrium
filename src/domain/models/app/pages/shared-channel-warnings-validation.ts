/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Load-time WARNINGS about shared-filter channels, printed by `validate`,
 * `start` and `build` beside the deprecation warnings.
 *
 * ─── WHY WARNINGS, NOT REFUSALS ────────────────────────────────────────────
 *
 * A channel joins the controls that publish on it to the data components that
 * listen on it, and either side may be written before the other: a page whose
 * grid listens on `deals` while its controls are still to come is a page in
 * progress, not a broken one. So a channel with only one side is said out loud
 * and still accepted. The refusals that ARE survivable-never — two publishers
 * contributing one param, a subscriber consuming a key its channel never
 * publishes — stay in `shared-filter-validation.ts`.
 *
 * The scan is per page. A component placed through `{ component: name }` is
 * read from the app's `components`, so a library block's controls count for
 * the page that places it.
 */

/** One warning: where, and what. */
export interface SharedChannelWarning {
  readonly path: string
  readonly message: string
}

/** The two sides of every channel on one page. */
interface ChannelSides {
  readonly published: ReadonlySet<string>
  readonly listened: ReadonlySet<string>
  /** Component ids, which a legacy id-based subscription names as its channel. */
  readonly ids: ReadonlySet<string>
}

const stringAt = (record: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

/** The channel a node publishes on, if it publishes. */
const publishedChannel = (node: Readonly<Record<string, unknown>>): readonly string[] => {
  const { publishes } = node
  const channel = isRecord(publishes) ? stringAt(publishes, 'bindTo') : undefined
  return channel === undefined ? [] : [channel]
}

/** The channel a data source subscribes to with `sharedFilter`, if it does. */
const subscribedChannel = (source: unknown): readonly string[] => {
  if (!isRecord(source)) return []
  const { system } = source
  if (isRecord(system)) return subscribedChannel(system)
  const channel = stringAt(source, 'bindTo')
  return channel !== undefined && source['sharedFilter'] !== undefined ? [channel] : []
}

/** The component an `{ component: name }` reference places, from the app's templates. */
const referenced = (
  node: Readonly<Record<string, unknown>>,
  templates: readonly unknown[]
): unknown => {
  const name = node['type'] === undefined ? stringAt(node, 'component') : undefined
  if (name === undefined) return undefined
  return templates.find((template) => isRecord(template) && template['name'] === name)
}

/** Every component node under `value`, references expanded once. */
const nodesUnder = (
  value: unknown,
  templates: readonly unknown[]
): readonly Readonly<Record<string, unknown>>[] => {
  if (Array.isArray(value)) return value.flatMap((item) => nodesUnder(item, templates))
  if (!isRecord(value)) return []
  const placed = referenced(value, templates)
  const own = Object.values(value).flatMap((child) => nodesUnder(child, templates))
  return [value, ...own, ...(placed === undefined ? [] : nodesUnder(placed, []))]
}

const sidesOf = (nodes: readonly Readonly<Record<string, unknown>>[]): ChannelSides => ({
  published: new Set(nodes.flatMap(publishedChannel)),
  listened: new Set(nodes.flatMap((node) => subscribedChannel(node['dataSource']))),
  ids: new Set(
    nodes.flatMap((node) => {
      const { props } = node
      const id = isRecord(props) ? stringAt(props, 'id') : undefined
      return id === undefined ? [] : [id]
    })
  ),
})

const channelWarningsOn = (page: unknown, path: string, templates: readonly unknown[]) => {
  if (!isRecord(page)) return []
  const sides = sidesOf(nodesUnder(page['components'], templates))
  const unfed = [...sides.listened]
    .filter((channel) => !sides.published.has(channel) && !sides.ids.has(channel))
    .map((channel) => ({
      path,
      message: `${path}: data components listen on channel "${channel}" and no control publishes on it on this page — give a control \`publishes: { bindTo: ${channel} }\`, or check the spelling`,
    }))
  const unheard = [...sides.published]
    .filter((channel) => !sides.listened.has(channel))
    .map((channel) => ({
      path,
      message: `${path}: a control publishes on channel "${channel}" and nothing listens to it — subscribe a data component with \`dataSource.bindTo: ${channel}\` and \`sharedFilter: {}\`, or check the spelling`,
    }))
  return [...unfed, ...unheard]
}

/** One warning per one-sided channel of each page. */
export const collectSharedChannelWarnings = (config: unknown): readonly SharedChannelWarning[] => {
  if (!isRecord(config) || !Array.isArray(config['pages'])) return []
  const templates = Array.isArray(config['components']) ? config['components'] : []
  return config['pages'].flatMap((page, index) =>
    channelWarningsOn(page, `pages[${index}]`, templates)
  )
}
