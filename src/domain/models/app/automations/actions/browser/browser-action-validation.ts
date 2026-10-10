/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hostOf, isAllowedHost, writtenOutUrl } from './browser-host-service'
import { validateBrowserRuns } from './browser-run-validation'

/**
 * Every rule of a browser action refused before the app starts, each naming
 * the automation, the action and the step.
 *
 * The `browser/run` step rules live in `browser-run-validation.ts`; this adds
 * the two the AI half of the family brings:
 *
 * - **`heal: true`** is refused on an `optional` step and on a click marked
 *   `irreversible`. The step schema holds the same rule, but it reports a
 *   position in the config, and the person reading the refusal needs the name
 *   of the automation and of the step they wrote.
 * - **A `browser/agent` start address** written out on a host outside its
 *   `allowedHosts` is refused, naming the host. It relates two props of the
 *   action, so it has no schema home.
 *
 * Pure: runs over the raw config before the decode.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One browser action, with the automation it belongs to. */
interface BrowserActionAt {
  readonly automation: string
  readonly action: RawRecord
}

/** Every browser action reachable from `value`, however deeply a `path` or a `loop` nests it. */
function browserActionsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(browserActionsOf)
  if (!isRecord(value)) return []
  const self = value['type'] === 'browser' ? [value] : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    browserActionsOf
  )
  return [...self, ...nested]
}

const browserActionsOfConfig = (config: unknown): readonly BrowserActionAt[] => {
  const automations = isRecord(config) ? config['automations'] : undefined
  if (!Array.isArray(automations)) return []
  return automations.filter(isRecord).flatMap((automation) =>
    browserActionsOf(automation['actions']).map((action) => ({
      automation: String(automation['name'] ?? '(unnamed)'),
      action,
    }))
  )
}

const propsOf = (action: RawRecord): RawRecord => (isRecord(action['props']) ? action['props'] : {})

const actionName = (at: BrowserActionAt): string =>
  `Automation '${at.automation}', action '${String(at.action['name'] ?? '(unnamed)')}'`

/** Why a step's `heal: true` is refused, or `undefined`. */
const healRefusal = (step: RawRecord): string | undefined => {
  if (step['heal'] !== true) return undefined
  if (step['optional'] === true) {
    return '`heal: true` is refused on an `optional` step: its element being absent is the expected case, so a guess never stands in for it'
  }
  if (step['do'] === 'click' && step['irreversible'] === true) {
    return '`heal: true` is refused on a click marked `irreversible`: a guess never stands in for a submission'
  }
  return undefined
}

/** The refusals of a `browser/run`'s `heal` switches. */
const healRefusals = (at: BrowserActionAt): readonly string[] => {
  const { steps } = propsOf(at.action)
  if (at.action['operator'] !== 'run' || !Array.isArray(steps)) return []
  return steps.filter(isRecord).flatMap((step, index) => {
    const refusal = healRefusal(step)
    if (refusal === undefined) return []
    const label = typeof step['label'] === 'string' ? ` "${step['label']}"` : ''
    return [
      `${actionName(at)}, browser step ${String(index + 1)} (${String(step['do'] ?? '?')}${label}): ${refusal}`,
    ]
  })
}

/** The refusal of a `browser/agent` start address off its `allowedHosts`. */
const startRefusals = (at: BrowserActionAt): readonly string[] => {
  if (at.action['operator'] !== 'agent') return []
  const props = propsOf(at.action)
  const url = writtenOutUrl(props['startUrl'])
  const hosts = Array.isArray(props['allowedHosts'])
    ? props['allowedHosts'].filter((h): h is string => typeof h === 'string')
    : []
  if (url === undefined || isAllowedHost(url, hosts)) return []
  return [
    `${actionName(at)}, browser agent: the start address ${url} goes to ${hostOf(url)}, which is not in allowedHosts (${hosts.join(', ')}). Add the host to allowedHosts, or start on a page of a listed host.`,
  ]
}

/**
 * Refuse every browser action rule that names a step or a host: the
 * `browser/run` step rules, a misplaced `heal: true`, and an agent start
 * address off its `allowedHosts`.
 *
 * @returns one message per refusal, empty when every browser action is valid
 */
export function validateBrowserActions(config: unknown): readonly string[] {
  const actions = browserActionsOfConfig(config)
  return [
    ...validateBrowserRuns(config),
    ...actions.flatMap(healRefusals),
    ...actions.flatMap(startRefusals),
  ]
}
