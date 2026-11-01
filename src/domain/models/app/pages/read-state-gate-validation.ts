/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * A page decode rule for a button's read gates (`hiddenWhenRead`,
 * `disabledWhenRead`): the source a gate follows must exist on the page.
 *
 * A `component` must be the `props.id` of a data component that announces its
 * reads — a `table` or a `kanban` — and a `channel` must be one such
 * component's `dataSource.bindTo` (or its system source's). Either typo would
 * leave the gate following nothing, so a button hidden on `loading` would never
 * show: refused at startup, naming the gate and the name.
 *
 * Scoped so it cannot become a false refusal: a page that places a component
 * template (`$ref`, or `component:` in a placement's shape) may hold the source
 * inside that template, which this pass does not expand, so such a page is not
 * judged. A gate written inside a template is judged where it is placed, by
 * nothing yet: the template's own page is not visible here.
 *
 * Called from `collectPageBindingViolations` and from nowhere else, and shares
 * its contract: pure, no I/O, human-readable messages, empty when the page is
 * well-formed.
 *
 * @see ./page-binding-validation.ts — the caller, and the other families
 */

type Node = Readonly<Record<string, unknown>>

/** The data component types that announce the state of their reads. */
const ANNOUNCING_TYPES: ReadonlySet<unknown> = new Set(['table', 'kanban'])

const GATE_KEYS = ['hiddenWhenRead', 'disabledWhenRead'] as const

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/**
 * A template placement, which may hold a source this pass cannot see: a `$ref`,
 * or a `component` naming a template, whatever else it carries (`vars`, `key`,
 * `slots`, `children`), as the openDialog check reads one. Told apart from an
 * action naming a component (it has an `action`) and from a read gate itself
 * (it has a `state`).
 */
const placesTemplate = (node: Node): boolean =>
  text(node['$ref']) !== undefined ||
  (node['type'] === undefined &&
    text(node['component']) !== undefined &&
    node['action'] === undefined &&
    node['state'] === undefined)

/** The id and channels a data component can be followed by. */
const namesOf = (node: Node): { readonly id?: string; readonly channels: readonly string[] } => {
  const source = isRecord(node['dataSource']) ? node['dataSource'] : {}
  const system = isRecord(source['system']) ? source['system'] : {}
  const props = isRecord(node['props']) ? node['props'] : {}
  const id = text(props['id'])
  const channels = [text(source['bindTo']), text(system['bindTo'])].filter(
    (channel): channel is string => channel !== undefined
  )
  return id === undefined ? { channels } : { id, channels }
}

/** The violation a button's gate under `key` makes, if its source is not on the page. */
const gateViolation = (
  gate: unknown,
  key: (typeof GATE_KEYS)[number],
  sources: { readonly ids: ReadonlySet<string>; readonly channels: ReadonlySet<string> },
  label: string
): readonly string[] => {
  if (!isRecord(gate)) return []
  const component = text(gate['component'])
  if (component !== undefined && !sources.ids.has(component))
    return [
      `${label} declares a button whose ${key} names component '${component}', but no table or kanban on the page has that props.id — give the data component props: { id: ${component} }, or name one that exists`,
    ]
  const channel = text(gate['channel'])
  if (channel !== undefined && !sources.channels.has(channel))
    return [
      `${label} declares a button whose ${key} names channel '${channel}', but no table or kanban on the page subscribes to it — give the data component dataSource.bindTo: ${channel}, or name a channel one subscribes to`,
    ]
  return []
}

export function readStateGateViolations(nodes: readonly Node[], label: string): readonly string[] {
  const buttons = nodes.filter(
    (node) => node['type'] === 'button' && GATE_KEYS.some((key) => node[key] !== undefined)
  )
  if (buttons.length === 0 || nodes.some(placesTemplate)) return []
  const named = nodes.filter((node) => ANNOUNCING_TYPES.has(node['type'])).map(namesOf)
  const sources = {
    ids: new Set(named.flatMap((names) => (names.id === undefined ? [] : [names.id]))),
    channels: new Set(named.flatMap((names) => names.channels)),
  }
  return buttons.flatMap((button) =>
    GATE_KEYS.flatMap((key) => gateViolation(button[key], key, sources, label))
  )
}
