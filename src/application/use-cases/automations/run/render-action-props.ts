/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result } from 'effect'
import { isSingleMailbox } from '@/domain/kernel/sanitize/email-validation'
import { groupListMemberRefusal } from '@/domain/models/app/automations/condition-validation'
import { templateContextPathsFor } from '@/domain/models/app/automations/template-context-service'
import { lookupPath, resolveTriggerInValue } from '../resolve-trigger-data'
import type {
  TemplateEncoding,
  TemplateRenderer,
} from '@/application/ports/services/template-engine'

/**
 * Fill in an action's props for the place each one lands.
 *
 * Most props are text, rendered as they always were. A few are a sink a value
 * from run data (a webhook body, a form, a record, a step output) could
 * rewrite, so they are rendered for their position instead
 * ({@link TemplateEncoding}): an `email/send` `body` as HTML, an `http/*` or
 * `webhook/send` `url` as URL components, and a string body sent as JSON as
 * JSON string content. And the address fields of `email/send` are checked:
 * a value from run data names exactly one recipient, and never the sender.
 *
 * A prop that cannot be filled in safely fails the step with a reason, before
 * the action runs.
 *
 * And a prop that is template TEXT (`template.inline`, `header.inline`, …: the
 * `templateContext` annotation, read off the schema) is left as written: its
 * action renders it, escaped for its output, against its `data` only.
 */

type Props = Readonly<Record<string, unknown>>

export interface RenderedActionProps {
  readonly props: Record<string, unknown>
  /** Why the step must fail without running, when a prop cannot be filled in safely. */
  readonly refusal?: string
  /** A named template's variables (`$vars`), filled in with the props, for its inline text. */
  readonly templateVars?: Readonly<Record<string, unknown>>
  /** The props are the configuration as written: the handler fills them in itself. */
  readonly authored?: true
  /**
   * The props are filled in, except those the handler fills itself
   * ({@link handlerFilledPropsFor}), which were kept as written: the handler
   * still fills them, when each piece is reached.
   */
  readonly handlerFills?: true
}

const HTTP_OPERATORS: ReadonlySet<string> = new Set([
  'request',
  'get',
  'post',
  'put',
  'patch',
  'delete',
])

const isJsonMediaType = (value: string): boolean => /application\/json|\+json/i.test(value)

/** The `Content-Type` an action's authored headers declare, any casing. */
const declaredContentType = (headers: unknown): string | undefined => {
  if (headers === null || typeof headers !== 'object') return undefined
  const entry = Object.entries(headers as Props).find(([k]) => k.toLowerCase() === 'content-type')
  return typeof entry?.[1] === 'string' ? entry[1] : undefined
}

/**
 * Whether a string body goes out as JSON: `webhook/send` sends JSON unless its
 * headers say otherwise; `http/*` when a header or `contentType: json` says so.
 */
const sendsJsonBody = (type: string, props: Props): boolean => {
  const declared = declaredContentType(props['headers'])
  if (declared !== undefined) return isJsonMediaType(declared)
  return type === 'webhook' || props['contentType'] === 'json'
}

/** Which props of this action are rendered for their position, and how. */
const encodingsFor = (
  type: string,
  operator: string,
  props: Props
): Readonly<Record<string, TemplateEncoding>> => {
  if (type === 'email' && operator === 'send') return { body: 'html' }
  const sendsRequest =
    (type === 'http' && HTTP_OPERATORS.has(operator)) || (type === 'webhook' && operator === 'send')
  if (!sendsRequest) return {}
  const jsonBody = typeof props['body'] === 'string' && sendsJsonBody(type, props)
  return jsonBody ? { url: 'url', body: 'json' } : { url: 'url' }
}

/**
 * Whether authored text takes a value from run data: it holds an expression
 * other than a `$env.` reference (the operator's own config).
 */
const takesRunData = (authored: string): boolean => /\{\{(?!\s*\$env\.\w+\s*\}\})/.test(authored)

/** A template that is exactly one `{{path}}`, whose value is read as it is. */
const WHOLE_PATH = /^\{\{\s*([\w.]+)\s*\}\}$/

/** The list a whole `{{path}}` template reads from run data, or `undefined` when it reads none. */
const wholeTemplateList = (authored: string, context: Props): readonly unknown[] | undefined => {
  const whole = WHOLE_PATH.exec(authored.trim())
  const found = whole === null ? undefined : lookupPath(context, whole[1] as string)
  return Array.isArray(found) ? found : undefined
}

/**
 * The recipients one authored address value names: a whole `{{path}}` reading
 * a list names each of its items, anything else the one rendered string.
 */
const recipientsOf = (authored: string, rendered: unknown, context: Props): readonly unknown[] =>
  wholeTemplateList(authored, context) ?? [rendered]

/**
 * The list a whole-template `in` / `notIn` value names, kept a list. The text
 * pass would render `{{trigger.data.statuses}}` as the text `normal,low`, and
 * the condition would compare against one string; read whole, it keeps the
 * list it points at. Anything else keeps its rendered value.
 */
const listTemplateValue = (condition: unknown, rendered: unknown, context: Props): unknown => {
  if (condition === null || typeof condition !== 'object') return rendered
  const { operator, value } = condition as Props
  if ((operator !== 'in' && operator !== 'notIn') || typeof value !== 'string') return rendered
  return wholeTemplateList(value, context) ?? rendered
}

/** One condition group (`filter` of a record step, `condition` of a filter) with its list templates kept. */
const keepListTemplatesIn = (authored: unknown, rendered: unknown, context: Props): unknown => {
  if (authored === null || typeof authored !== 'object') return rendered
  if (rendered === null || typeof rendered !== 'object') return rendered
  const { conditions } = authored as Props
  const { conditions: filled } = rendered as Props
  if (!Array.isArray(conditions) || !Array.isArray(filled)) return rendered
  return {
    ...(rendered as Props),
    conditions: filled.map((condition: unknown, index) => {
      if (condition === null || typeof condition !== 'object') return condition
      const { value } = condition as Props
      const kept = listTemplateValue(conditions[index], value, context)
      return kept === value ? condition : { ...(condition as Props), value: kept }
    }),
  }
}

/** The rendered props with the list templates of their condition groups kept lists. */
const keepListTemplates = (authored: Props, rendered: Props, context: Props): Props =>
  Object.fromEntries(
    Object.entries(rendered).map(([key, value]) => [
      key,
      key === 'filter' || key === 'condition'
        ? keepListTemplatesIn(authored[key], value, context)
        : value,
    ])
  )

/**
 * Why the filled props cannot be used, judged on the whole: a whole-template
 * list holding an object or a nested list cannot be compared, and an
 * `email/send` address from run data must name one recipient.
 */
const filledPropsRefusal = (input: {
  readonly type: string
  readonly operator: string
  readonly authored: Props
  readonly props: Props
  readonly context: Props
}): string | undefined =>
  groupListMemberRefusal(input.props['filter']) ??
  groupListMemberRefusal(input.props['condition']) ??
  (input.type === 'email' && input.operator === 'send'
    ? emailAddressRefusal(input.authored, input.props, input.context)
    : undefined)

const ADDRESS_FIELDS = ['from', 'to', 'cc', 'bcc', 'replyTo'] as const

/** Why one address field of `email/send` cannot be sent, or `undefined`. */
const addressRefusal = (
  field: (typeof ADDRESS_FIELDS)[number],
  authored: unknown,
  rendered: unknown,
  context: Props
): string | undefined => {
  const items = Array.isArray(authored)
    ? authored.map((item, i) => [item, Array.isArray(rendered) ? rendered[i] : undefined] as const)
    : [[authored, rendered] as const]
  const fromData = items.filter(
    (pair): pair is readonly [string, unknown] =>
      typeof pair[0] === 'string' && takesRunData(pair[0])
  )
  if (fromData.length === 0) return undefined
  if (field === 'from') return '`from` must be written in the config, not taken from run data'
  const named = fromData.flatMap(([text, value]) => recipientsOf(text, value, context))
  const ok = named.every(
    (v) => v === '' || v === undefined || (typeof v === 'string' && isSingleMailbox(v))
  )
  return ok ? undefined : `\`${field}\` from run data must be exactly one address`
}

const emailAddressRefusal = (
  authored: Props,
  rendered: Props,
  context: Props
): string | undefined =>
  ADDRESS_FIELDS.map((field) =>
    addressRefusal(field, authored[field], rendered[field], context)
  ).find((reason) => reason !== undefined)

/**
 * Props a handler fills in itself, one piece at a time, which the run keeps AS
 * WRITTEN: never referenced for `$env`, never rendered. A `browser/run` fills
 * each of its `steps` when the step is reached, inside the driver, so a `$env`
 * secret or a one-time code it types never reaches the stored input; a
 * `browser/agent` fills its `credentials` the same way.
 */
export const handlerFilledPropsFor = (type: string, operator: string): readonly string[] =>
  type === 'browser' ? (operator === 'run' ? ['steps'] : ['credentials']) : []

/** `referenced` (the authored props, `$env` referenced) with the handler-filled props put back as written. */
export const keepHandlerFilledProps = <A>(
  referenced: A,
  written: unknown,
  type: string,
  operator: string
): A => {
  const keys = handlerFilledPropsFor(type, operator)
  if (keys.length === 0 || written === null || typeof written !== 'object') return referenced
  const original = written as Props
  return {
    ...(referenced as Props),
    ...Object.fromEntries(keys.filter((key) => key in original).map((key) => [key, original[key]])),
  } as A
}

/**
 * Render `value` with `renderValue`, except at the `skip` paths (relative to
 * `value`), which are kept as written: template TEXT its action renders itself
 * (the `templateContext` annotation). Only an object is descended into; a
 * value that is not one at a skip path's prefix is rendered whole.
 */
const renderExcept = (
  value: unknown,
  skip: ReadonlyArray<string>,
  renderValue: (value: unknown) => unknown
): unknown => {
  if (skip.includes('')) return value
  if (skip.length === 0 || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return renderValue(value)
  }
  return Object.fromEntries(
    Object.entries(value as Props).map(([key, child]) => {
      const under = skip
        .filter((path) => path === key || path.startsWith(`${key}.`))
        .map((path) => path.slice(key.length + 1))
      return [
        key,
        under.length === 0 ? renderValue(child) : renderExcept(child, under, renderValue),
      ]
    })
  )
}

/**
 * Fill in `authored` (an action's props as written, `$env.` already turned
 * into values the pass inserts) for the action `type`/`operator`.
 * `renderValue` fills in a prop with no position of its own — the run loop's
 * text pass by default, or a handler's typed pass for a nested action.
 */
export const renderActionProps = (input: {
  readonly type: string
  readonly operator: string
  readonly authored: unknown
  readonly context: Props
  readonly templates: TemplateRenderer
  readonly renderValue?: (value: unknown) => unknown
}): RenderedActionProps => {
  const { type, operator, context, templates } = input
  const renderValue =
    input.renderValue ?? ((value: unknown) => resolveTriggerInValue(value, context, templates))
  if (input.authored === null || typeof input.authored !== 'object') {
    return { props: (renderValue(input.authored) ?? {}) as Record<string, unknown> }
  }
  const authored = input.authored as Props
  const encodings = encodingsFor(type, operator, authored)
  const skipped = [
    ...templateContextPathsFor(type, operator).map((entry) => entry.path),
    ...handlerFilledPropsFor(type, operator),
  ]
  const entries = Object.entries(authored).map(([key, value]) => {
    const encoding = encodings[key]
    const under = skipped
      .filter((path) => path === key || path.startsWith(`${key}.`))
      .map((path) => path.slice(key.length + 1))
    if (under.length > 0) {
      return { key, value: renderExcept(value, under, renderValue), refusal: undefined }
    }
    if (encoding === undefined || typeof value !== 'string') {
      return { key, value: renderValue(value), refusal: undefined }
    }
    return Result.match(templates.renderFor(value, context, encoding), {
      onSuccess: (text) => ({ key, value: text as unknown, refusal: undefined }),
      onFailure: (reason) => ({ key, value: value as unknown, refusal: `\`${key}\`: ${reason}` }),
    })
  })
  const props = keepListTemplates(
    authored,
    Object.fromEntries(entries.map(({ key, value }) => [key, value])),
    context
  )
  const refused =
    entries.find((entry) => entry.refusal !== undefined)?.refusal ??
    filledPropsRefusal({ type, operator, authored, props, context })
  return refused === undefined
    ? { props }
    : { props, refusal: `${type}.${operator} refused: ${refused}` }
}
