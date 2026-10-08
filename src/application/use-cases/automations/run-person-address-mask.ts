/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A run's values as a reader who is not an admin is shown them: each person a
 * record step expanded — a single `user` field read as `{ id, name, email }` —
 * keeps its id and name, and its address is masked (`redactEmail`). The run
 * itself, its templates and the stored row keep the full address; only what
 * leaves through the run history, the trigger response and the MCP tools that
 * start a run is masked.
 *
 * A step is masked by the fields its table declares as single `user` fields,
 * at the four places a record step puts a person: `records[i].<field>`,
 * `records[i].fields.<field>`, `record.<field>` and `record.fields.<field>`.
 * An ordinary email column is never touched. A step whose table cannot be
 * named from the automation falls back to masking every object that has
 * exactly the expanded person's shape, and so does the trigger data a record or
 * a comment trigger hands the run (its persons, its comment author).
 *
 * Pure: it reads the app's configuration and the values handed to it, so every
 * road that shows a run — the HTTP routes and the MCP tools — masks alike.
 */

import { redactEmail } from '@/domain/kernel/sanitize/email-redaction'
import { singleUserFieldNames } from './hydrated-field-reference'
import type { App } from '@/domain/models/app'

type Json = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** An expanded person: exactly `id`, `name` and a string `email`. */
const isPerson = (value: unknown): value is Json & { readonly email: string } =>
  isObject(value) &&
  typeof value['email'] === 'string' &&
  Object.keys(value).toSorted().join(',') === 'email,id,name'

const maskedPerson = (person: Json & { readonly email: string }): Json => ({
  ...person,
  email: redactEmail(person.email),
})

/** The action named `stepName` anywhere in an action tree (paths, loops) that reads a table. */
const findTableOfStep = (node: unknown, stepName: string): string | undefined => {
  if (Array.isArray(node)) {
    return node.reduce<string | undefined>(
      (found, child) => found ?? findTableOfStep(child, stepName),
      undefined
    )
  }
  if (!isObject(node)) return undefined
  const { props } = node
  if (node['name'] === stepName && isObject(props) && typeof props['table'] === 'string') {
    return props['table']
  }
  return findTableOfStep(Object.values(node), stepName)
}

/**
 * The single `user` fields of the table the named step reads, or `undefined`
 * when the automation names no table for that step.
 */
export const personFieldsOfStep = (
  app: App,
  automationName: string,
  stepName: string
): readonly string[] | undefined => {
  const automation = app.automations?.find((candidate) => candidate.name === automationName)
  const table = findTableOfStep(automation?.actions, stepName)
  return table === undefined ? undefined : singleUserFieldNames(app, table)
}

/** A record with each named person field masked, at its top level and under `fields`. */
const maskRecord = (record: unknown, names: readonly string[]): unknown => {
  if (!isObject(record)) return record
  const maskIn = (source: Json): Json => ({
    ...source,
    ...Object.fromEntries(
      names.flatMap((name) => {
        const value = source[name]
        return isPerson(value) ? [[name, maskedPerson(value)] as const] : []
      })
    ),
  })
  const { fields } = record
  return { ...maskIn(record), ...(isObject(fields) ? { fields: maskIn(fields) } : {}) }
}

/** Every object of `value`, at any depth, with exactly the expanded person's shape, masked. */
export const maskByShape = (value: unknown): unknown => {
  if (isPerson(value)) return maskedPerson(value)
  if (Array.isArray(value)) return value.map(maskByShape)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, maskByShape(child)]))
}

/** Each string of a list masked as an address; anything else kept as is. */
const maskedAddressList = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? redactEmail(entry) : entry))
    : value

/**
 * A comment trigger's data with the addresses it carries masked, by key:
 * `threadParticipants[]`, `mentionedEmails[]` and `comment.author.email`.
 * Nothing else is read — the comment's body is the author's own words.
 */
export const maskCommentTriggerAddresses = (triggerData: unknown): unknown => {
  if (!isObject(triggerData)) return triggerData
  const { comment } = triggerData
  const author = isObject(comment) ? comment['author'] : undefined
  const authorEmail = isObject(author) ? author['email'] : undefined
  return {
    ...triggerData,
    ...('threadParticipants' in triggerData
      ? { threadParticipants: maskedAddressList(triggerData['threadParticipants']) }
      : {}),
    ...('mentionedEmails' in triggerData
      ? { mentionedEmails: maskedAddressList(triggerData['mentionedEmails']) }
      : {}),
    ...(isObject(comment) && isObject(author) && typeof authorEmail === 'string'
      ? { comment: { ...comment, author: { ...author, email: redactEmail(authorEmail) } } }
      : {}),
  }
}

/**
 * A run's trigger data as a reader who is not an admin and did not start it is
 * shown it: each expanded person masked by shape, and — when the automation is
 * triggered by a comment — the comment's addresses masked by key.
 */
export const triggerDataWithMaskedAddresses = (
  app: App,
  automationName: string,
  triggerData: unknown
): unknown => {
  const byShape = maskByShape(triggerData)
  const automation = app.automations?.find((candidate) => candidate.name === automationName)
  return automation?.trigger.type === 'comment' ? maskCommentTriggerAddresses(byShape) : byShape
}

/**
 * A step's output with each person's address masked: at the named person
 * fields of its `record` and `records`, or — when `names` is `undefined` — at
 * every object with the expanded person's shape.
 */
export const maskPersonAddresses = (output: unknown, names: readonly string[] | undefined) => {
  if (names === undefined) return maskByShape(output)
  if (!isObject(output) || names.length === 0) return output
  const { record, records } = output
  return {
    ...output,
    ...(record === undefined ? {} : { record: maskRecord(record, names) }),
    ...(Array.isArray(records) ? { records: records.map((row) => maskRecord(row, names)) } : {}),
  }
}

/** A published step, with the steps a path or a loop ran inside it. */
interface MaskableStep {
  readonly name: string
  readonly output: unknown
  readonly paths?: ReadonlyArray<{ readonly steps: readonly MaskableStep[] }>
  readonly iterations?: ReadonlyArray<{ readonly steps: readonly MaskableStep[] }>
}

/** A published step with every person's address masked, at every depth. */
export const stepWithMaskedAddresses = <T extends MaskableStep>(
  app: App,
  automationName: string,
  step: T
): T => {
  const maskRun = (run: { readonly steps: readonly MaskableStep[] }) => ({
    ...run,
    steps: run.steps.map((nested) => stepWithMaskedAddresses(app, automationName, nested)),
  })
  const names = personFieldsOfStep(app, automationName, step.name)
  return {
    ...step,
    output: maskPersonAddresses(step.output, names),
    ...(step.paths === undefined ? {} : { paths: step.paths.map(maskRun) }),
    ...(step.iterations === undefined ? {} : { iterations: step.iterations.map(maskRun) }),
  }
}

/**
 * A run's last output — every step's output merged — with each person's
 * address masked: by the person fields of every step that ran, when each one
 * names its table, else by shape.
 */
export const lastOutputWithMaskedAddresses = (
  app: App,
  automationName: string,
  input: { readonly stepNames: readonly string[]; readonly output: unknown }
): unknown => {
  const perStep = input.stepNames.map((name) => personFieldsOfStep(app, automationName, name))
  const names = perStep.every((fields) => fields !== undefined)
    ? [...new Set(perStep.flatMap((fields) => fields ?? []))]
    : undefined
  return maskPersonAddresses(input.output, names)
}

/**
 * A run's last output as a reader may see it: whole when she reads every run
 * (an admin-equivalent), each expanded person's address masked otherwise.
 */
export const lastOutputAsSeenBy = (
  app: App,
  input: {
    readonly automationName: string
    readonly readsWhole: boolean
    readonly result: {
      readonly actions: Readonly<Record<string, unknown>>
      readonly lastOutput?: unknown
    }
  }
): unknown => {
  const { automationName, readsWhole, result } = input
  if (readsWhole || result.lastOutput === undefined) return result.lastOutput
  return lastOutputWithMaskedAddresses(app, automationName, {
    stepNames: Object.keys(result.actions),
    output: result.lastOutput,
  })
}
