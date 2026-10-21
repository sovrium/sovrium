/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One `CanonicalStep` as one Sovrium action.
 *
 * - A generic HTTP step becomes `http/request`; a credential header was
 *   already dropped by the adapter.
 * - An app step lands on a shared connection (`flow-app-call-service.ts`): a
 *   `connection/call` of the library's or the observed-apps catalogue's, or an
 *   `http/request` on one when its endpoint is not declared. One the registry
 *   maps to a Sovrium action becomes that action when the row says where each
 *   prop is read from.
 * - A pause becomes `delay/wait` when its duration has an exact equivalent.
 * - A step the registry maps to nothing (a no-op node) is dropped, and said so.
 * - A code step becomes a `code/runTypescript` stub keeping the original code,
 *   line for line, as comments, with the credentials its strings held removed;
 *   it is always a TODO.
 * - Anything else becomes the same stub quoting the step's definition, so the
 *   automation keeps its shape and validates, and the step is a TODO.
 */

import { capabilityOf, reportedHost, toEnvName } from './capability-url-service'
import { redactSourceCode } from './code-credential-redaction-service'
import { quoteOriginal } from './credential-redaction-service'
import { appCallOutcome, appCallWords, resolveAppCall } from './flow-app-call-service'
import { toSovriumDuration } from './flow-control-service'
import { render, renderText, type RenderContext } from './flow-expression-service'
import { fieldsMapOf, sourceFieldsOf } from './flow-set-fields-service'
import { lookupStep, type AutomationSourceTool, type StepMapping } from './flow-step-mappings'
import { targetWords } from './flow-step-targets'
import {
  languageDisplayName,
  sourceStepPhrase,
  sourceTypePhrase,
  toolDisplayName,
} from './source-display-name-service'
import type { CanonicalStep } from './canonical-flow'
import type { ConnectionCall, LibraryConnection } from './flow-app-call-service'
import type { FieldsSource } from './flow-set-fields-mappings'
import type { ConfigEntry } from './table-mapper-service'

export type { ConnectionCall, LibraryConnection } from './flow-app-call-service'

/** One step mapped: its action, and what it needs or leaves to finish. */
export interface StepOutcome {
  readonly action: ConfigEntry
  readonly todo?: { readonly original: string; readonly reason: string }
  readonly connection?: ConnectionCall
  /** What the mapping loses, when the registry row says so. */
  readonly loss?: string
  /** A URL that is a credential, now read from this env variable. */
  readonly secretUrl?: SecretUrl
}

/** A capability URL moved out of the config into an env variable. */
export interface SecretUrl {
  /** The variable NAME the action reads the URL from. */
  readonly env: string
  /** The URL's host, the only part a report may quote. */
  readonly host: string
}

/** Where one step lands, and what it reads to get there. */
export interface StepPlacement {
  /** The derived Sovrium action name. */
  readonly name: string
  /** The automation's name, so a URL moved to the environment gets a name of its own. */
  readonly automation?: string
  /** The step's label in its source tool, as the report quotes it. */
  readonly label: string
  readonly tool: AutomationSourceTool
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** The `connections[]` name a connection need was given; absent, its slug. */
  readonly connectionName?: (need: ConnectionCall) => string
  readonly rendering: RenderContext
}

/** Every line of the original kept as a comment of a stub `execute`. */
export const codeStub = (header: string, original: string): string =>
  [
    `// TODO: ${header}`,
    '// The original is kept below as comments; it is never run. Rewrite it in TypeScript,',
    '// then switch the automation on.',
    '//',
    ...original.split('\n').map((line) => `// ${line}`),
    'async function execute(context: CodeContext) {',
    '  return {}',
    '}',
  ].join('\n')

/** A `code/runTypescript` stub named `name`, and the TODO it carries. */
export const stub = (
  name: string,
  header: string,
  original: string,
  reason: string
): StepOutcome => ({
  action: {
    name,
    type: 'code',
    operator: 'runTypescript',
    props: { code: codeStub(header, original) },
  },
  todo: { original, reason },
})

type StepOf<K extends CanonicalStep['kind']> = Extract<CanonicalStep, { readonly kind: K }>

/** A URL written as plain text: a string, or an expression made of text alone. */
const plainUrlOf = (url: unknown): string | undefined => {
  if (typeof url === 'string') return url
  if (typeof url !== 'object' || url === null) return undefined
  const { tokens } = url as { readonly tokens?: unknown }
  if (!Array.isArray(tokens)) return undefined
  const parts = tokens.map((token: unknown) =>
    typeof token === 'object' && token !== null && (token as { kind?: unknown }).kind === 'text'
      ? String((token as { value?: unknown }).value ?? '')
      : undefined
  )
  return parts.every((part) => part !== undefined) ? parts.join('') : undefined
}

/** The env variable a credential URL moves to, or `undefined` for an ordinary URL. */
const secretUrlOf = (step: StepOf<'http'>, target: StepPlacement): SecretUrl | undefined => {
  const plain = plainUrlOf(step.url)
  const host = plain === undefined ? 'its destination' : reportedHost(plain)
  if (step.urlEnv !== undefined) return { env: step.urlEnv, host }
  if (plain === undefined || capabilityOf(plain) === undefined) return undefined
  return { env: toEnvName(target.automation ?? '', target.name, 'url'), host }
}

const mapHttp = (step: StepOf<'http'>, target: StepPlacement): StepOutcome => {
  const { rendering } = target
  const secretUrl = secretUrlOf(step, target)
  const body = step.body === undefined ? {} : { body: render(step.body, rendering) }
  const headers =
    Object.keys(step.headers).length === 0 ? {} : { headers: render(step.headers, rendering) }
  const props = {
    method: step.method.toUpperCase(),
    url: secretUrl === undefined ? render(step.url, rendering) : `$env.${secretUrl.env}`,
    ...headers,
    ...body,
  }
  return {
    action: { name: target.name, type: 'http', operator: 'request', props },
    ...(secretUrl === undefined ? {} : { secretUrl }),
  }
}

/** The props an action row reads from the step inputs, or `undefined` when one is absent. */
const actionProps = (
  params: Readonly<Record<string, string>>,
  inputs: Readonly<Record<string, unknown>>,
  rendering: RenderContext
): Readonly<Record<string, unknown>> | undefined => {
  const read = Object.entries(params).map(([prop, key]) => {
    const optional = key.endsWith('?')
    const value = inputs[optional ? key.slice(0, -1) : key]
    return { prop, value, missing: value === undefined && !optional }
  })
  if (read.some((one) => one.missing)) return undefined
  return Object.fromEntries(
    read.flatMap(({ prop, value }) =>
      value === undefined ? [] : [[prop, renderText(value, rendering)] as const]
    )
  )
}

/** `the n8n step "Notify"`, or with a kind, `the n8n JavaScript step "Score lead"`. */
const stepWords = (target: StepPlacement, kind = 'step'): string =>
  `the ${toolDisplayName(target.tool)} ${kind} "${target.label}"`

/** Sovrium has no step for this one: why it is a stub. */
const noStepFor = (phrase: string, also = ''): string =>
  `Sovrium has no step for ${phrase} yet${also}; it is kept as a stub to rebuild.`

/** An app step in a reader's words, its raw id in parentheses. */
const appPhrase = (step: StepOf<'app-action'>, target: StepPlacement): string =>
  sourceStepPhrase(target.tool, step.app, step.operation)

const appStub = (step: StepOf<'app-action'>, target: StepPlacement, reason: string) =>
  stub(
    target.name,
    `rebuild ${stepWords(target)}`,
    quoteOriginal({ app: step.app, operation: step.operation, inputs: step.inputs }),
    reason
  )

/** What a set step that also handed on the rest of its input loses as `data/set`. */
const KEEPS_INPUT_LOSS =
  'The step also handed on the other fields of its input; a data/set step holds only its named fields, so a later reference to another input field reads nothing'

/** A set step's named values as `data/set` `fields`, or `undefined` when it names none. */
const fieldsProps = (
  spec: FieldsSource,
  step: StepOf<'app-action'>,
  rendering: RenderContext
): { readonly props: Readonly<Record<string, unknown>>; readonly loss?: string } | undefined => {
  const fields = sourceFieldsOf(spec, step.inputs)
  if (fields === undefined) return undefined
  return {
    props: { fields: fieldsMapOf(fields, (value) => render(value, rendering)) },
    ...(fields.keepsInput ? { loss: KEEPS_INPUT_LOSS } : {}),
  }
}

/** The props an action row reads, and what reading them loses. */
const nativeProps = (
  step: StepOf<'app-action'>,
  row: StepMapping,
  rendering: RenderContext
): { readonly props: Readonly<Record<string, unknown>>; readonly loss?: string } | undefined => {
  if (row.fields !== undefined) return fieldsProps(row.fields, step, rendering)
  const props =
    row.params === undefined ? undefined : actionProps(row.params, step.inputs, rendering)
  return props === undefined ? undefined : { props }
}

/** An app step the registry maps to a Sovrium action. */
const mapNativeAction = (
  step: StepOf<'app-action'>,
  row: StepMapping,
  target: StepPlacement
): StepOutcome => {
  if (row.target.kind !== 'action') return appStub(step, target, 'No action is named.')
  const { type, operator } = row.target.action
  const read = nativeProps(step, row, target.rendering)
  if (read === undefined) {
    return appStub(
      step,
      target,
      `${appPhrase(step, target)} maps to ${type}/${operator}, but its inputs do not carry over.`
    )
  }
  const loss = [row.loss, read.loss].filter((one) => one !== undefined).join('. ')
  return {
    action: { name: target.name, type, operator, props: read.props },
    ...(loss === '' ? {} : { loss }),
  }
}

const mapAppActionFrom = (step: StepOf<'app-action'>, target: StepPlacement): StepOutcome => {
  const row = lookupStep(target.tool, step.app, step.operation)
  if (row?.target.kind === 'todo') return appStub(step, target, `${row.target.reason}.`)
  if (row?.target.kind === 'action') return mapNativeAction(step, row, target)
  const call = resolveAppCall(step, row, target)
  if (call === undefined) {
    return appStub(step, target, noStepFor(appPhrase(step, target)))
  }
  const outcome = appCallOutcome(step, call, target)
  return row?.loss === undefined ? outcome : { ...outcome, loss: row.loss }
}

/**
 * A step whose export carries no inputs: mapped like any other, then a TODO
 * whatever it became, because every input it had is set by hand.
 */
/** Why a step whose export carries no inputs is a TODO, naming where it lands. */
const withoutInputsReason = (step: StepOf<'app-action'>, target: StepPlacement): string => {
  const row = lookupStep(target.tool, step.app, step.operation)
  if (row?.target.kind === 'todo')
    return `${row.target.reason}; the export carries none of its inputs either.`
  const call = resolveAppCall(step, row, target)
  const words =
    row?.target.kind === 'action'
      ? targetWords(row)
      : call && appCallWords(call, target.connectionName?.(call.need) ?? call.need.slug)
  return words === undefined
    ? noStepFor(appPhrase(step, target), ', and the export carries none of its inputs')
    : `${appPhrase(step, target)} maps to ${words}, but the export carries none of its inputs: set them by hand.`
}

/** The `{{todo.<name>}}` placeholders an action holds, by name, once each. */
const placeholdersOf = (action: ConfigEntry): readonly string[] => [
  ...new Set(
    [...JSON.stringify(action['props'] ?? {}).matchAll(/\{\{todo\.([A-Za-z0-9_]+)\}\}/g)].map(
      (match) => match[1] ?? ''
    )
  ),
]

/**
 * What a step without inputs adds to its reason: an http request says what to
 * set; a connection call names its placeholders, its own TODO restating the
 * mapping the reason already gives.
 */
const withoutInputsDetail = (outcome: StepOutcome): string | undefined => {
  const { type } = outcome.action
  if (type === 'code') return undefined
  if (type !== 'connection') return outcome.todo?.reason
  const names = placeholdersOf(outcome.action).map((name) => `\`${name}\``)
  return names.length === 0
    ? undefined
    : `Each of ${names.join(', ')} is a {{todo.<name>}} placeholder in its place.`
}

const withoutInputsOutcome = (step: StepOf<'app-action'>, target: StepPlacement): StepOutcome => {
  const outcome = mapAppActionFrom(step, target)
  const reason = withoutInputsReason(step, target)
  // A typed call or request says which placeholders stand for the missing inputs.
  const detail = withoutInputsDetail(outcome)
  return {
    ...outcome,
    todo: {
      original:
        outcome.todo?.original ?? quoteOriginal({ app: step.app, operation: step.operation }),
      reason: detail === undefined ? reason : `${reason} ${detail}`,
    },
  }
}

const mapAppAction = (step: StepOf<'app-action'>, target: StepPlacement): StepOutcome =>
  step.withoutInputs === true ? withoutInputsOutcome(step, target) : mapAppActionFrom(step, target)

/** A pause as `delay/wait`, or a stub when it has no exact equivalent. */
const mapDelay = (step: StepOf<'delay'>, target: StepPlacement): StepOutcome => {
  const duration = step.duration === undefined ? undefined : toSovriumDuration(step.duration)
  const props =
    duration !== undefined
      ? { duration }
      : step.until === undefined
        ? undefined
        : { until: renderText(step.until, target.rendering) }
  if (props === undefined) {
    return stub(
      target.name,
      `rebuild ${stepWords(target, 'pause')}`,
      quoteOriginal(step),
      'The pause has no exact Sovrium duration (a month, a year, or no duration at all).'
    )
  }
  return { action: { name: target.name, type: 'delay', operator: 'wait', props } }
}

/** What a code step's report says about the credentials removed from its quoted code. */
const removedNote = (removed: number): string =>
  removed === 0
    ? ''
    : ` ${removed} credential ${removed === 1 ? 'value was' : 'values were'} removed from the code it quotes; read them from the environment when you rewrite it.`

/** A code step as a stub quoting its code, every credential in its strings removed. */
const mapCode = (step: StepOf<'code'>, target: StepPlacement): StepOutcome => {
  const { code, removed } = redactSourceCode(step.source, step.lang)
  return stub(
    target.name,
    `rewrite ${stepWords(target, `${languageDisplayName(step.lang)} step`)}`,
    code,
    `A code step is kept as a stub; its code is never translated.${removedNote(removed)}`
  )
}

/**
 * Why a step is dropped — the registry maps it to nothing — or `undefined`
 * when it becomes an action.
 */
export const droppedReason = (
  step: CanonicalStep,
  tool: AutomationSourceTool
): string | undefined => {
  const row =
    step.kind === 'unknown'
      ? lookupStep(tool, step.sourceType)
      : step.kind === 'app-action'
        ? lookupStep(tool, step.app, step.operation)
        : undefined
  return row?.target.kind === 'none' ? row.target.reason : undefined
}

/**
 * Why a step with no action of its own is a stub: no registry row maps it, or
 * one does but the step's parameters have no counterpart in that action (an
 * n8n Set node in raw JSON mode, which names no field).
 */
const unmappedReason = (step: CanonicalStep, target: StepPlacement): string => {
  const what =
    step.kind === 'unknown' ? sourceTypePhrase(target.tool, step.sourceType) : stepWords(target)
  const row = step.kind === 'unknown' ? lookupStep(target.tool, step.sourceType) : undefined
  if (row?.target.kind !== 'action') return noStepFor(what)
  const { type, operator } = row.target.action
  return `${what} maps to ${type}/${operator}, but its parameters do not carry over to it.`
}

/** One step as one action. A branch, a loop or a filter is the block emitter's. */
export const mapStep = (step: CanonicalStep, target: StepPlacement): StepOutcome => {
  if (step.kind === 'code') return mapCode(step, target)
  if (step.kind === 'http') return mapHttp(step, target)
  if (step.kind === 'app-action') return mapAppAction(step, target)
  if (step.kind === 'delay') return mapDelay(step, target)
  const original = quoteOriginal(step.kind === 'unknown' ? step.raw : step)
  return stub(target.name, `rebuild ${stepWords(target)}`, original, unmappedReason(step, target))
}
