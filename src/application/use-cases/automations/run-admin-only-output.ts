/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The output keys a run shows only to a reader who reads every run (an
 * admin-equivalent): the `journal` of an instance `health` step and the
 * `lines` of an instance `logs` step. Both are what a supervised app printed,
 * and a crashing app prints its secrets. Anyone else allowed to read the run —
 * whoever started it by hand, an approver — sees the step and the rest of its
 * output without those lines.
 *
 * The lines stay admin-only wherever the run carries them: a later step that
 * substitutes them (`{{steps.probe.journal}}` into an alert) publishes them
 * under its own key, so every string a non-admin reader receives from the run
 * has each admin-only line painted over with `***` — raw, or JSON-escaped as a
 * substituted array renders it.
 *
 * A step is named by the automation, so it is found in the automation's action
 * tree as a run executes it (`$ref` templates expanded), at any depth a step
 * can sit. A run an MCP client started from an action template is found in
 * that template's action.
 *
 * Pure: it reads the app's configuration and the values handed to it, so every
 * road that shows a run — the run history, the trigger response and the MCP
 * tools — strips alike.
 */

import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import type { App } from '@/domain/models/app'

type Json = Readonly<Record<string, unknown>>

/**
 * The automation name a run started from action template `<name>` over MCP
 * carries, as `synthesizeAutomation` in `presentation/api/mcp/action-call.ts`
 * names it.
 */
const MCP_ACTION_RUN_PREFIX = 'mcp-action:'

/** The output key each instance operator keeps for an admin-equivalent reader. */
const ADMIN_ONLY_KEY: Readonly<Record<string, string>> = { health: 'journal', logs: 'lines' }

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The action tree a run of `automationName` executes, `$ref` templates expanded. */
const actionTreeOf = (app: App, automationName: string): unknown => {
  const templates = (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  if (automationName.startsWith(MCP_ACTION_RUN_PREFIX)) {
    const name = automationName.slice(MCP_ACTION_RUN_PREFIX.length)
    return templates.filter((template) => template.name === name).map(({ action }) => action)
  }
  const automation = app.automations?.find((candidate) => candidate.name === automationName)
  if (automation === undefined) return []
  return expandRefActions(automation.actions as readonly unknown[] as readonly Json[], templates)
}

/**
 * Every instance step `node` holds that keeps a key for an admin, as
 * `[stepName, key]`, in the order a depth-first walk meets them.
 */
const adminOnlyEntries = (node: unknown): ReadonlyArray<readonly [string, string]> => {
  if (Array.isArray(node)) return node.flatMap(adminOnlyEntries)
  if (!isObject(node)) return []
  const { type, operator, name } = node
  const key =
    type === 'instance' && typeof operator === 'string' ? ADMIN_ONLY_KEY[operator] : undefined
  const own = key === undefined ? [] : [[String(name ?? ''), key] as const]
  return [...own, ...Object.values(node).flatMap(adminOnlyEntries)]
}

/**
 * The admin-only key of each instance step of `automationName`, by step name —
 * the first one a walk meets when two steps share a name. Read once per road,
 * not once per published step: a loop of a thousand items is a thousand steps.
 */
const adminOnlyKeysOf = (app: App, automationName: string): ReadonlyMap<string, string> =>
  new Map(adminOnlyEntries(actionTreeOf(app, automationName)).toReversed())

/**
 * The output key of the step named `stepName` that only an admin-equivalent
 * reads — `journal` for an instance health step, `lines` for an instance logs
 * step — or `undefined` for any other step.
 */
export const adminOnlyKeyOfStep = (
  app: App,
  automationName: string,
  stepName: string
): string | undefined => adminOnlyKeysOf(app, automationName).get(stepName)

/** `output` without `key`, or `output` itself when it does not carry it. */
const withoutKey = (output: unknown, key: string | undefined): unknown => {
  if (key === undefined || !isObject(output) || !(key in output)) return output
  return Object.fromEntries(Object.entries(output).filter(([name]) => name !== key))
}

/**
 * Shorter lines are not painted: a lone `}` or `OK` would deface every string
 * the reader receives, and carries nothing a crash would leak.
 */
const MIN_PAINTED_LENGTH = 6

/** The lines an admin-only value holds — a `journal` or `lines` array — worth painting over. */
const linesOf = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (line): line is string => typeof line === 'string' && line.trim().length >= MIN_PAINTED_LENGTH
  )

/** Each line, raw and as JSON escapes it inside a string, the longest first. */
const paintedForms = (lines: readonly string[]): readonly string[] =>
  [...new Set(lines.flatMap((line) => [line, JSON.stringify(line).slice(1, -1)]))].toSorted(
    (left, right) => right.length - left.length
  )

/**
 * `text` with every form painted over. A form longer than what is left of the
 * text cannot occur in it and costs no search: most strings a run carries are
 * shorter than a log line.
 */
const paintText = (text: string, forms: readonly string[]): string =>
  forms.reduce(
    (painted, form) => (form.length > painted.length ? painted : painted.replaceAll(form, '***')),
    text
  )

/** `value` with every admin-only line painted over in each string it holds, at any depth. */
const paintOver = (value: unknown, forms: readonly string[]): unknown => {
  if (typeof value === 'string') return paintText(value, forms)
  if (Array.isArray(value)) return value.map((item) => paintOver(item, forms))
  if (!isObject(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, paintOver(v, forms)]))
}

/** A published step, with the steps a path or a loop ran inside it. */
interface StrippableStep {
  readonly name: string
  readonly output: unknown
  readonly error?: string | null
  readonly logs?: unknown
  readonly paths?: ReadonlyArray<{ readonly steps: readonly StrippableStep[] }>
  readonly iterations?: ReadonlyArray<{ readonly steps: readonly StrippableStep[] }>
}

/** The lines of every health and logs step in `steps`, at any depth. */
const linesOfSteps = (
  keys: ReadonlyMap<string, string>,
  steps: readonly StrippableStep[]
): readonly string[] =>
  steps.flatMap((step) => {
    const key = keys.get(step.name)
    const own = key !== undefined && isObject(step.output) ? linesOf(step.output[key]) : []
    const inner = [...(step.paths ?? []), ...(step.iterations ?? [])].flatMap((run) =>
      linesOfSteps(keys, run.steps)
    )
    return [...own, ...inner]
  })

/**
 * Every admin-only line a run's steps carry, at any depth: the `journal` of
 * each health step and the `lines` of each logs step, as they ran.
 */
export const adminOnlyLinesOfSteps = (
  app: App,
  automationName: string,
  steps: readonly StrippableStep[]
): readonly string[] => linesOfSteps(adminOnlyKeysOf(app, automationName), steps)

/** A code step's log entries with each message painted; the level is the contract's. */
const paintLogs = (logs: unknown, forms: readonly string[]): unknown =>
  Array.isArray(logs)
    ? logs.map((entry) =>
        isObject(entry) && typeof entry['message'] === 'string'
          ? { ...entry, message: paintText(entry['message'], forms) }
          : entry
      )
    : logs

/**
 * `step` without its admin-only key, and with each line painted over in what
 * the step CARRIES — its output, its error and its log messages — at every
 * depth. Its name, status and timings are the run's contract, never painted: a
 * log line that reads `completed` must not turn a step status into `***`.
 */
const strippedStep = <T extends StrippableStep>(
  keys: ReadonlyMap<string, string>,
  step: T,
  forms: readonly string[]
): T => {
  const stripRun = <R extends { readonly steps: readonly StrippableStep[] }>(run: R): R => ({
    ...run,
    steps: run.steps.map((nested) => strippedStep(keys, nested, forms)),
  })
  const output = withoutKey(step.output, keys.get(step.name))
  return {
    ...step,
    output: forms.length === 0 ? output : paintOver(output, forms),
    ...(typeof step.error === 'string' ? { error: paintText(step.error, forms) } : {}),
    ...(step.logs === undefined ? {} : { logs: paintLogs(step.logs, forms) }),
    ...(step.paths === undefined ? {} : { paths: step.paths.map(stripRun) }),
    ...(step.iterations === undefined ? {} : { iterations: step.iterations.map(stripRun) }),
  }
}

/**
 * A published step without its admin-only lines, at every depth: the key a
 * health or a logs step keeps is dropped, and each of the run's admin-only
 * `lines` is painted over wherever the step carries it.
 */
export const stepWithoutAdminOnlyLines = <T extends StrippableStep>(
  app: App,
  automationName: string,
  step: T,
  lines: readonly string[] = []
): T => strippedStep(adminOnlyKeysOf(app, automationName), step, paintedForms(lines))

/**
 * Text the run carries outside its steps — its own error, an approval request's
 * message — with each admin-only line of `lines` painted over.
 */
export const textWithoutAdminOnlyLines = (text: string, lines: readonly string[]): string =>
  lines.length === 0 ? text : paintText(text, paintedForms(lines))

/** Every admin-only line the outputs of a finished run's steps carry, keyed by step name. */
const linesOfOutputs = (
  keys: ReadonlyMap<string, string>,
  actions: Readonly<Record<string, unknown>>
): readonly string[] =>
  linesOfSteps(
    keys,
    Object.entries(actions).map(([name, output]) => ({ name, output }))
  )

/**
 * A finished run's own error as its answer shows it: whole to an
 * admin-equivalent, and to anyone else with each admin-only line its steps
 * carry painted over — a step that failed quoting the journal fails the run
 * with the same text.
 */
export const runErrorAsSeenBy = (
  app: App,
  input: {
    readonly automationName: string
    readonly readsWhole: boolean
    readonly result: {
      readonly actions: Readonly<Record<string, unknown>>
      readonly error?: string | undefined
    }
  }
): string | undefined => {
  const { automationName, readsWhole, result } = input
  if (readsWhole || result.error === undefined) return result.error
  const lines = linesOfOutputs(adminOnlyKeysOf(app, automationName), result.actions)
  return textWithoutAdminOnlyLines(result.error, lines)
}

/**
 * A run's last output — every step's output shallow-merged, later steps
 * winning — without the admin-only lines: a key is dropped when the last step
 * that wrote it is a health or a logs step keeping it for an admin, and each
 * admin-only line a step's output carries is painted over wherever it was copied.
 */
export const lastOutputWithoutAdminOnlyLines = (
  app: App,
  automationName: string,
  input: { readonly actions: Readonly<Record<string, unknown>>; readonly output: unknown }
): unknown => {
  const { actions, output } = input
  if (!isObject(output)) return output
  const keys = adminOnlyKeysOf(app, automationName)
  const writerOf = (key: string): string | undefined =>
    Object.keys(actions)
      .filter((stepName) => {
        const stepOutput = actions[stepName]
        return isObject(stepOutput) && key in stepOutput
      })
      .at(-1)
  const dropped = Object.values(ADMIN_ONLY_KEY).filter((key) => {
    const writer = key in output ? writerOf(key) : undefined
    return writer !== undefined && keys.get(writer) === key
  })
  const kept =
    dropped.length === 0
      ? output
      : Object.fromEntries(Object.entries(output).filter(([key]) => !dropped.includes(key)))
  const lines = linesOfOutputs(keys, actions)
  return lines.length === 0 ? kept : paintOver(kept, paintedForms(lines))
}
