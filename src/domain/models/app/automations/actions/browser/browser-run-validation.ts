/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDuration } from '@/domain/kernel/time/parse-duration'
import { envReferencesIn } from '@/domain/models/app/env-reference-service'
import { hostOf, isAllowedHost, writtenOutUrl } from './browser-host-service'
import { LOCATOR_KINDS } from './step-locator'

/**
 * The rules of a `browser/run` step that are refused before the app starts,
 * each naming the automation, the action and the browser step.
 *
 * Two of them the schema also holds — a locator with exactly one way of
 * finding its element, and `confirm` only on an irreversible click — and are
 * repeated here for one reason: the schema reports a POSITION in the config,
 * and the person reading it needs the NAME of the automation they wrote. This
 * runs over the raw config before the decode, so its message is the one read.
 * The third — a written-out `goto` must stay on `allowedHosts` — has no schema
 * home at all: it relates two props of the action. Nor has the fourth — a
 * `goto` address reads only a variable `app.env` declares `secret: false` —
 * which relates the step to the app's `env` declarations.
 *
 * {@link browserHoldRefusals} needs the operator's `BROWSER_HOLD_MAX_MS` and
 * is run at boot. Pure.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A `browser/run` action, with the automation it belongs to. */
interface BrowserRunAt {
  readonly automation: string
  readonly action: RawRecord
}

/**
 * Every `browser/run` action reachable from an automation's `actions`, however
 * deeply a `path` or a `loop` nests it. Only the keys that hold steps are
 * followed.
 */
function browserRunsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(browserRunsOf)
  if (!isRecord(value)) return []
  const self = value['type'] === 'browser' && value['operator'] === 'run' ? [value] : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    browserRunsOf
  )
  return [...self, ...nested]
}

/** Every `browser/run` action of the config, with its automation's name. */
const browserRunsOfConfig = (config: unknown): readonly BrowserRunAt[] => {
  const automations = isRecord(config) ? config['automations'] : undefined
  if (!Array.isArray(automations)) return []
  return automations.filter(isRecord).flatMap((automation) =>
    browserRunsOf(automation['actions']).map((action) => ({
      automation: String(automation['name'] ?? '(unnamed)'),
      action,
    }))
  )
}

const stepsOf = (action: RawRecord): readonly RawRecord[] => {
  const props = isRecord(action['props']) ? action['props'] : {}
  return Array.isArray(props['steps']) ? props['steps'].filter(isRecord) : []
}

const allowedHostsOf = (action: RawRecord): readonly string[] => {
  const props = isRecord(action['props']) ? action['props'] : {}
  const hosts = props['allowedHosts']
  return Array.isArray(hosts) ? hosts.filter((h): h is string => typeof h === 'string') : []
}

/** `Automation 'x', action 'browse', browser step 3 (click)`. */
const where = (at: BrowserRunAt, step: RawRecord, index: number): string => {
  const label = typeof step['label'] === 'string' ? ` "${step['label']}"` : ''
  return `Automation '${at.automation}', action '${String(at.action['name'] ?? '(unnamed)')}', browser step ${String(index + 1)} (${String(step['do'] ?? '?')}${label})`
}

/** Why a locator is refused, or `undefined`. */
const locatorRefusal = (locator: unknown): string | undefined => {
  if (!isRecord(locator)) return undefined
  const kinds = LOCATOR_KINDS.filter((kind) => locator[kind] !== undefined)
  if (kinds.length !== 1 || (locator['name'] !== undefined && locator['role'] === undefined)) {
    return 'a locator takes exactly one of `role`, `label`, `text`, `placeholder`, `testId` and `selector`; `name` requires `role`'
  }
  return undefined
}

/** The locators a step names: its target, and the `fields` of an `extract`. */
const locatorsOf = (step: RawRecord): readonly unknown[] => [
  step['target'],
  ...(isRecord(step['fields']) ? Object.values(step['fields']) : []),
]

/** Why one step is refused, or `undefined`. */
const stepRefusal = (step: RawRecord, allowedHosts: readonly string[]): string | undefined => {
  const locator = locatorsOf(step)
    .map(locatorRefusal)
    .find((reason) => reason !== undefined)
  if (locator !== undefined) return locator
  if (step['confirm'] !== undefined && step['irreversible'] !== true) {
    return '`confirm` is only allowed on a click marked `irreversible: true`'
  }
  const url = step['do'] === 'goto' ? writtenOutUrl(step['url']) : undefined
  if (url !== undefined && !isAllowedHost(url, allowedHosts)) {
    return `${url} goes to ${hostOf(url)}, which is not in allowedHosts (${allowedHosts.join(', ')}). Add the host to allowedHosts, or go to a page on a listed host.`
  }
  return undefined
}

/** The keys `app.env` declares, and those of them declared `secret: false`. */
interface EnvDeclarations {
  readonly declared: ReadonlySet<string>
  readonly plain: ReadonlySet<string>
}

const keysOf = (entries: readonly RawRecord[]): ReadonlySet<string> =>
  new Set(entries.map((entry) => entry['key']).filter((key) => typeof key === 'string'))

const envDeclarationsOf = (config: unknown): EnvDeclarations => {
  const env = isRecord(config) && Array.isArray(config['env']) ? config['env'].filter(isRecord) : []
  return {
    declared: keysOf(env),
    plain: keysOf(env.filter((entry) => entry['secret'] === false)),
  }
}

/** The variables a `goto` step's `url` reads, in order of first appearance. */
const gotoEnvReads = (step: RawRecord): readonly string[] =>
  step['do'] === 'goto' && typeof step['url'] === 'string' ? envReferencesIn(step['url']) : []

/**
 * A `goto` address is recorded in the trace and the run output, so it may read
 * only a variable declared `secret: false`. An undeclared one is left to the
 * check every `$env` reference meets (`env-reference-validation.ts`).
 */
const gotoEnvRefusals = (
  at: BrowserRunAt,
  step: RawRecord,
  index: number,
  env: EnvDeclarations
): readonly string[] =>
  gotoEnvReads(step)
    .filter((name) => env.declared.has(name) && !env.plain.has(name))
    .map(
      (name) =>
        `${where(at, step, index)} reads $env.${name} in \`url\`, but ${name} is not declared \`secret: false\`. A goto address is shown in the run's trace and output: declare ${name} \`secret: false\` if it holds no credential, or type the secret with a fill step.`
    )

/**
 * Refuse every browser step whose locator is ambiguous, whose `confirm` sits
 * on a click not marked irreversible, whose written-out `goto` leaves
 * `allowedHosts`, or whose `goto` address reads a variable not declared
 * `secret: false`. The `env` declarations are read from `config` itself.
 *
 * @returns one message per refusal, empty when every step is valid
 */
export function validateBrowserRuns(config: unknown): readonly string[] {
  const env = envDeclarationsOf(config)
  return browserRunsOfConfig(config).flatMap((at) => {
    const allowedHosts = allowedHostsOf(at.action)
    return stepsOf(at.action).flatMap((step, index) => {
      const refusal = stepRefusal(step, allowedHosts)
      return [
        ...(refusal === undefined ? [] : [`${where(at, step, index)}: ${refusal}`]),
        ...gotoEnvRefusals(at, step, index, env),
      ]
    })
  })
}

/**
 * The variables a `goto` address of the app reads that are declared
 * `secret: false` — the only ones it may read, so their values are shown in a
 * run's record as the address they are part of, never masked.
 */
export function gotoAddressVariables(config: unknown): ReadonlySet<string> {
  const { plain } = envDeclarationsOf(config)
  return new Set(
    browserRunsOfConfig(config)
      .flatMap((at) => stepsOf(at.action).flatMap(gotoEnvReads))
      .filter((name) => plain.has(name))
  )
}

/** The hold a `confirm` asks for, in milliseconds, or `undefined` when it names none. */
const confirmHoldMs = (step: RawRecord): number | undefined => {
  const confirm = isRecord(step['confirm']) ? step['confirm'] : undefined
  const timeout = confirm?.['timeout']
  if (typeof timeout !== 'string') return undefined
  const ms = parseDuration(timeout.replace(/\s+/g, ''))
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Refuse every `confirm` whose `timeout` would hold the browser longer than the
 * operator allows (`BROWSER_HOLD_MAX_MS`).
 *
 * @returns one message per refused step
 */
export function browserHoldRefusals(config: unknown, holdMaxMs: number): readonly string[] {
  return browserRunsOfConfig(config).flatMap((at) =>
    stepsOf(at.action).flatMap((step, index) => {
      const hold = confirmHoldMs(step)
      return hold === undefined || hold <= holdMaxMs
        ? []
        : [
            `${where(at, step, index)}: confirm.timeout holds the browser for ${String(hold)} ms, longer than the ${String(holdMaxMs)} ms the operator allows (BROWSER_HOLD_MAX_MS). Shorten the timeout, or raise BROWSER_HOLD_MAX_MS.`,
          ]
    })
  )
}
