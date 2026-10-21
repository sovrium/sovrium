/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Emitting a tokenised source expression as a Sovrium template.
 *
 * Every automation source tokenises its own template language into the same
 * tokens (`CanonicalExpression`); this module is the one place those tokens
 * become Sovrium's `{{ … }}` syntax:
 *
 * - a trigger reference becomes `{{trigger.data.<path>}}`;
 * - a step reference becomes `{{<action name>.result.<path>}}`, the action
 *   name being the one the mapper derived for that step and a field a set
 *   step renamed read under its new name — or, inside a loop
 *   over that step, `{{loop.item.<path>}}` (`{{loops.<name>.item.<path>}}`
 *   for an outer loop);
 * - a call of a source function becomes the helper its tool's registry names
 *   (`flow-expression-mappings.ts`), `{{formatDate (now) "yyyy-MM-dd"}}`;
 * - a construct that does not translate — an `unsupported` token, a function
 *   with no row, a date pattern with no equivalent — is written back without
 *   its braces, so it is never evaluated, and is reported as a TODO.
 */

import { convertMomentDateFormat } from './date-format-conversion-service'
import { lookupFunction, type FunctionMapping } from './flow-expression-mappings'
import { fieldReferencePath, type FieldPaths } from './flow-set-fields-service'
import { toSnakeName } from './import-names-service'
import type { CanonicalExpression, CanonicalExpressionToken } from './canonical-flow'
import type { AutomationSourceTool } from './flow-step-mappings'

/** What rendering a value reads besides the value. */
export interface RenderContext {
  /** The Sovrium action name derived for each source step id. */
  readonly actionOf: ReadonlyMap<string, string>
  /** The tool whose function registry applies. */
  readonly tool: AutomationSourceTool
  /** The ids of the loop steps around the value, innermost last. */
  readonly loops?: readonly string[]
  /**
   * Where a trigger reference reads from: `trigger.data`, or `trigger.data.body`
   * when the tool names a webhook's payload fields directly (Make's `{{1.x}}`)
   * and the Sovrium webhook trigger holds them under `body`.
   */
  readonly triggerRoot?: string
  /**
   * Where each named value of a step that became `data/set` with fields
   * landed, by source step id, so a reference to a renamed field follows it.
   */
  readonly fieldPaths?: ReadonlyMap<string, FieldPaths>
}

/** Whether a value is a tokenised source expression. */
export const isExpression = (value: unknown): value is CanonicalExpression =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'expression'

type Ref = Extract<CanonicalExpressionToken, { readonly kind: 'ref' }>
type Call = Extract<CanonicalExpressionToken, { readonly kind: 'call' }>

/** A path segment as Handlebars reads it: bare, or `[bracketed]` when it holds other characters. */
const segmentOf = (segment: string): string | undefined => {
  if (/^[A-Za-z0-9_$]+$/.test(segment)) return segment
  return segment === '' || segment.includes(']') ? undefined : `[${segment}]`
}

/** The template root a reference reads from. */
const rootOf = (token: Ref, context: RenderContext): string => {
  if (token.root === 'trigger') return context.triggerRoot ?? 'trigger.data'
  const step = token.step ?? ''
  const name = context.actionOf.get(step) ?? toSnakeName(step, 'step')
  const loops = context.loops ?? []
  if (!loops.includes(step)) return `${name}.result`
  return loops.at(-1) === step ? 'loop.item' : `loops.${name}.item`
}

/** A reference as a Handlebars path, or `undefined` when a segment cannot be written. */
const pathOf = (token: Ref, context: RenderContext): string | undefined => {
  const fieldPaths =
    token.root === 'trigger' ? undefined : context.fieldPaths?.get(token.step ?? '')
  const segments = fieldReferencePath(token.path, fieldPaths).map(segmentOf)
  if (segments.some((segment) => segment === undefined)) return undefined
  return [rootOf(token, context), ...segments].join('.')
}

/** A constant as a Handlebars literal, or `undefined` when it holds both quote characters. */
const literalOf = (value: string | number | boolean): string | undefined => {
  if (typeof value !== 'string') return String(value)
  if (/\\$/.test(value)) return undefined
  if (!value.includes('"')) return `"${value}"`
  return value.includes("'") ? undefined : `'${value}'`
}

/** One argument after the conversion its row names, or `undefined` when it does not convert. */
const convertedArgument = (
  token: CanonicalExpressionToken,
  row: FunctionMapping,
  index: number
): CanonicalExpressionToken | undefined => {
  const conversion = row.convert?.[index]
  if (conversion === undefined) return token
  if (token.kind !== 'literal' || typeof token.value !== 'string') return undefined
  const converted = convertMomentDateFormat(token.value)
  return converted === undefined ? undefined : { kind: 'literal', value: converted }
}

/** A mapped call as `helper arg …`, or `undefined` when it does not translate. */
const callBody = (token: Call, context: RenderContext): string | undefined => {
  const row = lookupFunction(context.tool, token.name)
  if (row === undefined) return undefined
  const [min, max] = row.arity
  if (token.args.length < min || token.args.length > max) return undefined
  const args = token.args.map((arg, index) => {
    const converted = convertedArgument(arg, row, index)
    return converted === undefined ? undefined : argumentOf(converted, context)
  })
  if (args.some((arg) => arg === undefined)) return undefined
  return [row.helper, ...args].join(' ')
}

/** A token in argument position, or `undefined` when it does not translate. */
function argumentOf(token: CanonicalExpressionToken, context: RenderContext): string | undefined {
  if (token.kind === 'ref') return pathOf(token, context)
  if (token.kind === 'literal') return literalOf(token.value)
  if (token.kind !== 'call') return undefined
  const body = callBody(token, context)
  return body === undefined ? undefined : `(${body})`
}

/** A token at the top of an expression, or `undefined` when it does not translate. */
const emitted = (token: CanonicalExpressionToken, context: RenderContext): string | undefined => {
  if (token.kind === 'text') return token.value
  if (token.kind === 'literal') return String(token.value)
  if (token.kind === 'unsupported') return undefined
  const body = token.kind === 'ref' ? pathOf(token, context) : callBody(token, context)
  return body === undefined ? undefined : `{{${body}}}`
}

/** The verbatim text of a token that does not translate. */
const sourceOf = (token: CanonicalExpressionToken): string => {
  if (token.kind === 'unsupported' || token.kind === 'call') return token.source
  if (token.kind === 'ref') return `{{${[token.step ?? token.root, ...token.path].join('.')}}}`
  return String(token.value)
}

const renderToken = (token: CanonicalExpressionToken, context: RenderContext): string =>
  emitted(token, context) ?? sourceOf(token).replace(/^\{\{\s*|\s*\}\}$/g, '')

/** The constructs inside a value that do not translate, verbatim and in order. */
export const untranslatedIn = (value: unknown, tool: AutomationSourceTool): readonly string[] => {
  if (isExpression(value)) {
    const context: RenderContext = { actionOf: new Map(), tool }
    return value.tokens.flatMap((token) =>
      emitted(token, context) === undefined ? [sourceOf(token)] : []
    )
  }
  if (Array.isArray(value)) return value.flatMap((item) => untranslatedIn(item, tool))
  if (typeof value === 'object' && value !== null)
    return Object.values(value).flatMap((item) => untranslatedIn(item, tool))
  return []
}

/** A value with every expression rewritten to Sovrium template syntax. */
export const render = (value: unknown, context: RenderContext): unknown => {
  if (isExpression(value)) return value.tokens.map((token) => renderToken(token, context)).join('')
  if (Array.isArray(value)) return value.map((item) => render(item, context))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, render(item, context)])
    )
  }
  return value
}

/** A value rendered to one template string, as a prop that takes text needs it. */
export const renderText = (value: unknown, context: RenderContext): string => {
  const rendered = render(value, context)
  return typeof rendered === 'string' ? rendered : JSON.stringify(rendered)
}
