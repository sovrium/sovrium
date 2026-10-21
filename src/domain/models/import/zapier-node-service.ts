/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One Zap step as a `CanonicalStep`, and a Zap's first step as a
 * `CanonicalTrigger`.
 *
 * A step is read the same way whichever file it came from: its app
 * (`selected_api`), its operation (`action`) and, when the export carries
 * them, its inputs (`params`). The registry row it matches decides what it
 * becomes: a code step, an HTTP request, a pause, a filter, or an app step the
 * mapper sends to its action or library connection. A step whose export
 * carries no inputs at all (an API dump) is marked so, and the mapper reports
 * every input as a TODO.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isCredentialName } from './credential-redaction-service'
import { lookupStep, lookupTrigger, type TriggerMapping } from './flow-step-mappings'
import { standsForAppEvent } from './flow-step-targets'
import { tokeniseZapierValue, type ZapierScope } from './zapier-expression-service'
import { conditionOfCriteria, cronOfSchedule } from './zapier-settings-service'
import { NO_APP, normaliseZapierApp, ZAPIER_RECORD_EVENTS } from './zapier-step-mappings'
import type { CanonicalCondition, CanonicalFlow, CanonicalStep } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>

/** A Zap step, whichever export it came from. */
export interface ZapierNode {
  readonly id: string
  readonly app: string
  readonly action: string
  /** The step's inputs; `undefined` when the export carries none. */
  readonly params: Json | undefined
  readonly title: string | undefined
  /** The Zapier connection the step runs with, labelled `zapier:<auth_id>`; never a secret. */
  readonly credential?: string
}

/** A step's Zapier connection as its credential label, when the export names one. */
const credentialOf = (auth: unknown): { readonly credential?: string } =>
  typeof auth === 'number' || (typeof auth === 'string' && auth !== '')
    ? { credential: `zapier:${String(auth)}` }
    : {}

/** A Zap step read from an export node or an API-dump step. */
export const zapierNodeOf = (raw: Json, fallbackId: string): ZapierNode => {
  const app = typeof raw['selected_api'] === 'string' ? raw['selected_api'] : NO_APP
  const { id, action, params, title, meta, auth_id: auth } = raw
  const stepTitle = isRecord(meta) ? meta['stepTitle'] : undefined
  const label = [title, stepTitle].find((one) => typeof one === 'string' && one.trim() !== '')
  return {
    id: typeof id === 'number' || typeof id === 'string' ? String(id) : fallbackId,
    app: app.split('@')[0] ?? app,
    action: typeof action === 'string' ? action : '',
    params: isRecord(params) ? params : undefined,
    title:
      typeof label === 'string' ? label.trim() : app === NO_APP ? 'Step with no app' : undefined,
    ...credentialOf(auth),
  }
}

/**
 * The operation a step is looked up by. A Formatter step adds the transform
 * it runs to its family (`datetime:formatting`); every other step is its
 * action.
 */
export const operationOf = (node: ZapierNode): string => {
  const transform = node.params?.['transform']
  return normaliseZapierApp(node.app) === 'ZapierFormatter' && typeof transform === 'string'
    ? `${node.action}:${transform}`
    : node.action
}

/** The label a step is shown and named by: its title, else its app and action. */
export const labelOf = (node: ZapierNode): string => node.title ?? appActionOf(node)

/** A step's app and action, an action that is an opaque id left out: `Code`, `Slack channel_message`. */
const appActionOf = (node: ZapierNode): string =>
  [normaliseZapierApp(node.app), OPAQUE_ID.test(node.action) ? '' : node.action]
    .filter((part) => part !== '')
    .join(' ')

/** An action that is a generated id rather than a name (a Code step's). */
const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LANGUAGE: Readonly<Record<string, 'javascript' | 'python'>> = { python: 'python' }

const NO_CODE = 'The export does not carry the code of this step.'

/**
 * A Code step, its code under one comment line naming the step it came from
 * (the action names the language and whether it ran async).
 */
const codeStep = (node: ZapierNode): CanonicalStep => {
  const code = node.params?.['code']
  const lang = Object.entries(LANGUAGE).find(([word]) => node.action.includes(word))?.[1]
  const comment = lang === 'python' ? '#' : '//'
  const header = `${comment} Zapier ${normaliseZapierApp(node.app)} step, action ${node.action || '(none)'}`
  return {
    id: node.id,
    name: labelOf(node),
    kind: 'code',
    lang: lang ?? 'javascript',
    source: `${header}\n${typeof code === 'string' && code !== '' ? code : `${comment} ${NO_CODE}`}`,
  }
}

/** The headers of a webhook step, the credential ones dropped. */
const headersOf = (value: unknown, scope: ZapierScope): Json =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value)
          .filter(([name]) => !isCredentialName(name))
          .map(([name, held]) => [name, tokeniseZapierValue(held, scope)])
      )
    : {}

/** A webhook step as an HTTP request, when the export carries its URL. */
const httpStep = (node: ZapierNode, scope: ZapierScope): CanonicalStep | undefined => {
  const params = node.params ?? {}
  const { url, method, headers, data } = params
  if (typeof url !== 'string' || url === '') return undefined
  const verb = node.action === 'custom' && typeof method === 'string' ? method : node.action
  return {
    id: node.id,
    name: labelOf(node),
    kind: 'http',
    method: verb.toUpperCase(),
    url: tokeniseZapierValue(url, scope),
    headers: headersOf(headers, scope),
    ...(data === undefined ? {} : { body: tokeniseZapierValue(data, scope) }),
  }
}

/** Zapier's delay units, as ISO 8601 duration parts. */
const DELAY_UNITS: Readonly<Record<string, (count: number) => string>> = {
  minutes: (count) => `PT${String(count)}M`,
  hours: (count) => `PT${String(count)}H`,
  days: (count) => `P${String(count)}D`,
  weeks: (count) => `P${String(count * 7)}D`,
}

/** The length a Delay For step states, as an ISO 8601 duration. */
const durationOf = (params: Json): string | undefined => {
  const { value, unit } = params
  const count = Number(value)
  if (typeof unit !== 'string' || !Number.isInteger(count) || count <= 0) return undefined
  return DELAY_UNITS[unit.toLowerCase()]?.(count)
}

/** A Delay step as a pause, when the export states its length or its end. */
const delayStep = (node: ZapierNode): CanonicalStep | undefined => {
  const params = node.params ?? {}
  const duration = durationOf(params)
  const { until } = params
  const end = node.action === 'delay_until' && typeof until === 'string' ? until : undefined
  if (duration === undefined && end === undefined) return undefined
  return {
    id: node.id,
    name: labelOf(node),
    kind: 'delay',
    ...(duration === undefined ? {} : { duration }),
    ...(end === undefined ? {} : { until: end }),
  }
}

/** A Filter step: a gate on its criteria, or the app step it stays when the export holds none. */
const filterStep = (node: ZapierNode, scope: ZapierScope): CanonicalStep | undefined => {
  const condition = conditionOfCriteria(node.params?.['filter_criteria'], scope)
  return condition === undefined
    ? undefined
    : { id: node.id, name: labelOf(node), kind: 'filter', condition }
}

/** The list a Looping step iterates when the export does not carry it: a TODO. */
const NO_LIST = {
  kind: 'expression',
  source: 'the values to loop over',
  tokens: [{ kind: 'unsupported', source: 'the values to loop over, which are not in the export' }],
}

/**
 * A Looping step: every step after it runs once per value, so the steps that
 * hang under it are its body. The list is its `values` input, when the export
 * carries it.
 */
const loopStep = (node: ZapierNode, scope: ZapierScope): CanonicalStep => {
  const values = node.params?.['values']
  return {
    id: node.id,
    name: labelOf(node),
    kind: 'loop',
    over: values === undefined ? NO_LIST : tokeniseZapierValue(values, scope),
  }
}

/** The action types a step is read as a dedicated kind for, by type. */
const TYPED_STEPS: Readonly<
  Record<string, (node: ZapierNode, scope: ZapierScope) => CanonicalStep | undefined>
> = {
  code: (node) => codeStep(node),
  http: httpStep,
  delay: (node) => delayStep(node),
  filter: filterStep,
  loop: loopStep,
}

/** The step a registry target gives a dedicated kind, or `undefined` for an app step. */
const typedStep = (node: ZapierNode, scope: ZapierScope): CanonicalStep | undefined => {
  const row = lookupStep('zapier', node.app, operationOf(node))
  const type = row?.target.kind === 'action' ? row.target.action.type : undefined
  if (node.params === undefined && type !== 'loop') return undefined
  return type === undefined ? undefined : TYPED_STEPS[type]?.(node, scope)
}

/** One Zap step as a canonical step. */
export const stepOfNode = (node: ZapierNode, scope: ZapierScope): CanonicalStep =>
  typedStep(node, scope) ?? {
    id: node.id,
    name: labelOf(node),
    kind: 'app-action',
    app: node.app,
    operation: operationOf(node),
    inputs: (tokeniseZapierValue(node.params ?? {}, scope) as Json | undefined) ?? {},
    ...(node.params === undefined ? { withoutInputs: true as const } : {}),
    ...(node.credential === undefined ? {} : { credential: node.credential }),
  }

/** A path of a Paths step: its label, and its rules when the export holds them. */
export const pathOfNode = (
  node: ZapierNode,
  index: number,
  scope: ZapierScope
): { readonly name: string; readonly condition: CanonicalCondition } => ({
  name: node.title ?? `Path ${String(index + 1)}`,
  condition: conditionOfCriteria(node.params?.['filter_criteria'], scope) ?? {
    combinator: 'and',
    rules: [{ left: 'the rules of this path', operator: 'not in the export' }],
  },
})

type Trigger = CanonicalFlow['trigger']

const textOf = (params: Json | undefined, ...keys: readonly string[]): string => {
  const found = keys.map((key) => params?.[key]).find((value) => typeof value === 'string')
  return typeof found === 'string' ? found : ''
}

/** The trigger's source credential, when the export names one. */
const credentialLabel = (node: ZapierNode) =>
  node.credential === undefined ? {} : { credential: node.credential }

/** The TODO a stand-in trigger carries, when its registry row states one. */
const standIn = (todo: string | undefined) => (todo === undefined ? {} : { todo })

/** Each Sovrium trigger type a Zap trigger maps to, and how its settings are read. */
const TRIGGERS: Readonly<Record<string, (node: ZapierNode, row: TriggerMapping) => Trigger>> = {
  webhook: (_node, row) => ({ kind: 'webhook', method: 'POST', ...standIn(row.todo) }),
  manual: (_node, row) => ({ kind: 'manual', ...standIn(row.todo) }),
  cron: (node) => {
    const cron = cronOfSchedule(node.action, node.params)
    return cron === undefined
      ? { kind: 'schedule', interval: `${appActionOf(node)} (its settings are not in the export)` }
      : { kind: 'schedule', cron }
  },
  record: (node) => ({
    kind: 'record',
    table: textOf(node.params, 'tableName', 'table', 'tableId'),
    events: ZAPIER_RECORD_EVENTS[node.action] ?? [],
  }),
  form: (node, row) => ({
    kind: 'form',
    form: textOf(node.params, 'form_id', 'form'),
    fallback: 'webhook',
    ...(row.connection === undefined
      ? {}
      : { registration: { ...row.connection, ...credentialLabel(node) } }),
  }),
}

/**
 * A Zap's first step as the trigger it maps to, through the trigger registry.
 * An app event whose row names the operation that registers its webhook, or
 * the call that polls it, stays an app event, on its own credential, so the
 * mapper installs that connection.
 * A form row's operation rides on the form trigger instead: it is installed
 * only when the form is not imported and the trigger falls back to a webhook.
 */
const appEventOf = (node: ZapierNode): Trigger => ({
  kind: 'app-event',
  app: node.app,
  event: node.action,
  inputs: node.params ?? {},
  ...credentialLabel(node),
})

export const triggerOfNode = (node: ZapierNode): Trigger => {
  const row = lookupTrigger('zapier', node.app, node.action)
  if (standsForAppEvent(row)) return appEventOf(node)
  const read = row === undefined ? undefined : TRIGGERS[row.target]
  return (
    (row === undefined ? undefined : read?.(node, row)) ?? {
      kind: 'unknown',
      sourceType:
        `${node.app} ${node.action}`.trim() || 'a trigger whose app the export does not name',
      raw: { app: node.app, action: node.action, params: node.params ?? 'not in the export' },
    }
  )
}
