/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Result, Schema } from 'effect'
import * as SchemaIssue from 'effect/SchemaIssue'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { App } from '@/domain/models/app'

/**
 * Decode an action's settings ONCE, where it is dispatched, and hand its
 * handler the decoded value.
 *
 * Every road reaches a handler through the registry (`ctx.handlers.get`): a
 * configured step, a retry, an action a `path` or a `loop` runs, a code step's
 * `context.actions.<type>.<operator>(props)`, an agent's tool call and an MCP
 * action call. Only the first passed the schema, when the config loaded; the
 * props a script or a client hands over never did. Wrapping the handler the
 * registry holds is the one place every road crosses, so a setting outside the
 * schema is refused there, before anything is sent, with what is wrong — and
 * the handler reads typed props instead of re-checking raw ones.
 *
 * The schema given is the action's DISPATCH shape: its `type`, `operator` and
 * `props`, as the handler receives them (its step name is passed through). Props a step's template pass
 * fills in can hold a value of another type than the one authored (a whole
 * `{{path}}` keeps the type of what it names), so a family whose authored props
 * are templates states the filled-in shape it accepts beside its handler.
 */

/** What selects an action's handler, and its props: the shape a handler is dispatched with. */
interface DispatchShape {
  readonly type: string
  readonly operator: string
  readonly props: object
}

/** The action a typed handler receives: its step name, and its decoded settings. */
export type DecodedAction<S extends Schema.Decoder<DispatchShape>> = {
  readonly name: string
} & S['Type']

/** A handler reading a decoded action (see {@link decodedHandler}). */
export type TypedActionHandler<A> = (
  action: A,
  app: App,
  automation: AutomationContext,
  runContext?: ActionRunContext
) => Effect.Effect<ActionOutcome, never, StepRequirements>

const descriptionIn = (annotations: { readonly description?: unknown } | undefined) =>
  typeof annotations?.description === 'string' ? annotations.description : undefined

/** The node an issue judged, when it names one, and the issue under it. */
const judgedBy = (
  issue: SchemaIssue.Issue
): { readonly described?: string; readonly next?: SchemaIssue.Issue } => {
  if (issue._tag === 'Filter') {
    return { described: descriptionIn(issue.filter.annotations), next: issue.issue }
  }
  if (issue._tag === 'Encoding') return { next: issue.issue }
  if (issue._tag === 'Composite' || issue._tag === 'AnyOf') {
    return { described: descriptionIn(issue.ast.annotations), next: issue.issues[0] }
  }
  return issue._tag === 'InvalidType' ? { described: descriptionIn(issue.ast.annotations) } : {}
}

/**
 * What the setting that failed is for, as its schema describes it — the
 * description closest to the value, never one of the object holding it (a
 * `Pointer` steps into a new value and forgets its parent's).
 */
const settingDescription = (issue: SchemaIssue.Issue, found?: string): string | undefined => {
  if (issue._tag === 'Pointer') return settingDescription(issue.issue)
  const { described, next } = judgedBy(issue)
  return next === undefined ? (described ?? found) : settingDescription(next, described ?? found)
}

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

/** The decoder's complaint, in a reader's words, with what the setting is for. */
const whatIsWrong = (message: string | undefined, described: string | undefined): string => {
  const complaint = message === 'Missing key' ? 'Required' : (message ?? 'Invalid value')
  return described === undefined ? complaint : `${complaint} (${described})`
}

/**
 * The refusal of an action whose settings fail its schema, naming the setting
 * and what it must be. The value given is never echoed: a header or a secret
 * a script built is exactly what a run history must not print.
 */
const settingsRefusal = (
  action: Readonly<Record<string, unknown>>,
  issue: SchemaIssue.Issue
): ActionOutcome => {
  const [first] = formatIssue(issue).issues
  const path = (first?.path ?? []).filter((segment) => segment !== 'props').join('.')
  const setting = path === '' ? 'its settings' : `\`${path}\``
  const label = `${String(action['type'] ?? '')}.${String(action['operator'] ?? '')}`
  return {
    status: 'failure',
    error: `${label} refused: ${setting} — ${whatIsWrong(first?.message, settingDescription(issue))}`,
    retryable: false,
  }
}

/**
 * Decode an action against its dispatch shape: its decoded settings under its
 * step name, or the refusal its step fails with.
 */
export const decodeDispatchedAction = <S extends Schema.Decoder<DispatchShape>>(schema: S) => {
  const decode = Schema.decodeUnknownResult(schema)
  return (
    action: Readonly<Record<string, unknown>>
  ): Readonly<Result.Result<DecodedAction<S>, ActionOutcome>> => {
    const decoded = decode(action)
    return Result.isFailure(decoded)
      ? Result.fail(settingsRefusal(action, decoded.failure.issue))
      : Result.succeed({ name: String(action['name'] ?? ''), ...decoded.success })
  }
}

/**
 * Register `run` behind a decode of the action's dispatch shape: a refused
 * action fails its step without running, never retried (it would be refused
 * the same way every time); a decoded one runs with its typed settings.
 */
export const decodedHandler = <S extends Schema.Decoder<DispatchShape>>(
  schema: S,
  run: TypedActionHandler<DecodedAction<S>>
): ActionHandler => {
  const decode = decodeDispatchedAction(schema)
  return (action, app, automation, runContext) =>
    Result.match(decode(action), {
      onFailure: (refusal) => Effect.succeed(refusal),
      onSuccess: (decoded) => run(decoded, app, automation, runContext),
    })
}
