/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { collectPlacements, type Placement } from './component-reference-validation'
import { ComponentSchema } from './components/component'
import { asPageNode } from './template-input-order-service'
import {
  embeddedJsonInputOf,
  expandTemplateInputs,
  substitutableInputsOf,
  type NodePointer,
} from './template-input-service'

/**
 * A template's structured inputs, checked against the app at startup.
 *
 * The schema accepts a template that declares `inputs` with any field holding
 * `$name`, because a field only takes its shape once a placement passes the
 * value. So the shape is checked here, once per placement, on the very node
 * the placement draws — and each refusal names the page, the placement and the
 * input, the three things an author needs to find the mistake:
 *
 * 1. A `json` input written inside a longer string: a structured value has no
 *    text to put there, so it must fill a whole field.
 * 2. A required input a placement leaves out.
 * 3. A `text`, `number` or `boolean` input given a list or an object.
 * 4. The expanded node refused as a page component: a value of the wrong shape
 *    for the field it fills (`columns` given a string).
 *
 * A placement written inside another template is checked where that template
 * is placed, since its values may be the outer template's own `$tokens`.
 */

/** Minimal shape needed to validate template inputs. */
interface AppForInputValidation {
  readonly pages?: unknown
  readonly components?: unknown
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every template that declares a substituting input, by name. */
const inputTemplates = (
  components: unknown
): ReadonlyMap<string, Readonly<Record<string, unknown>>> =>
  new Map(
    (Array.isArray(components) ? components : []).flatMap((template: unknown) =>
      isRecord(template) &&
      typeof template['name'] === 'string' &&
      substitutableInputsOf(template) !== undefined
        ? [[template['name'], template] as const]
        : []
    )
  )

/** The template-side refusal: a json input written inside a longer string. */
const embeddedViolation = (
  name: string,
  template: Readonly<Record<string, unknown>>
): string | undefined => {
  const inputs = substitutableInputsOf(template)
  const embedded = inputs === undefined ? undefined : embeddedJsonInputOf(template, inputs)
  return embedded === undefined
    ? undefined
    : `Template '${name}' writes its input '${embedded.input}', of kind json, inside the text '${embedded.text}'. A json input has no text of its own: it fills a field's whole value, so write the field as '$${embedded.input}' alone, or declare the input as text.`
}

/** The slash pointer to `target` under `node`, found by identity. */
const pointerTo = (node: unknown, target: unknown, at: string): string | undefined => {
  if (node === target) return at
  if (Array.isArray(node)) {
    return node
      .map((child: unknown, index) => pointerTo(child, target, `${at}/${String(index)}`))
      .find((found) => found !== undefined)
  }
  if (!isRecord(node)) return undefined
  return Object.entries(node)
    .map(([key, child]) => pointerTo(child, target, `${at}/${key}`))
    .find((found) => found !== undefined)
}

/** How a placement is named in a message: its `key`, or where the page writes it. */
const placementLabel = (placement: Placement, components: unknown): string => {
  const { key } = placement.node
  if (typeof key === 'string') return `'${key}'`
  return `at ${pointerTo(components, placement.node, '/components') ?? '/components'}`
}

/** A placement's values, from either spelling. */
const valuesOf = (placement: Placement): Readonly<Record<string, unknown>> => {
  const values = placement.node['variables'] ?? placement.node['vars']
  return isRecord(values) ? values : {}
}

/** Every path a decode issue points at, depth first. */
const issuePaths = (issue: unknown, at: NodePointer = []): readonly NodePointer[] => {
  if (!isRecord(issue)) return [at]
  const here =
    issue['_tag'] === 'Pointer' && Array.isArray(issue['path'])
      ? [...at, ...(issue['path'] as readonly (string | number)[])]
      : at
  const inner = isRecord(issue['issue']) ? [issue['issue']] : []
  const children = Array.isArray(issue['issues']) ? (issue['issues'] as readonly unknown[]) : []
  const nested = [...inner, ...children]
  return nested.length === 0 ? [here] : nested.flatMap((child) => issuePaths(child, here))
}

const startsWith = (path: NodePointer, prefix: NodePointer): boolean =>
  prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment)

/** The input whose value fills the field a decode issue points at, if one does. */
const culpritOf = (
  error: unknown,
  drawn: readonly { readonly input: string; readonly pointer: NodePointer }[]
): { readonly input: string; readonly field: string } | undefined => {
  const issue = isRecord(error) ? error['issue'] : undefined
  return issuePaths(issue)
    .flatMap((path) =>
      drawn
        .filter((entry) => startsWith(path, entry.pointer))
        .map((entry) => ({ input: entry.input, field: entry.pointer.join('.') }))
    )
    .at(0)
}

/** The decoder's own words for a failure, on one line. */
const decodeMessage = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/g, ' ').trim()

/** The placement-side refusals of one placement of a template that declares inputs. */
const placementViolation = (
  page: string,
  where: string,
  placement: Placement,
  template: Readonly<Record<string, unknown>>
): string | undefined => {
  const inputs = substitutableInputsOf(template)
  if (inputs === undefined) return undefined
  const values = valuesOf(placement)
  const head = `Page '${page}': the placement ${where} of template '${placement.name}'`
  const missing = [...inputs].find(
    ([name, input]) => input.required === true && values[name] === undefined
  )
  if (missing !== undefined) {
    return `${head} leaves out the required input '${missing[0]}'. Pass it in vars, or make the input optional in the template.`
  }
  const structured = [...inputs].find(
    ([name, input]) =>
      input.kind !== 'json' && typeof values[name] === 'object' && values[name] !== null
  )
  if (structured !== undefined) {
    return `${head} passes a list or an object to the input '${structured[0]}', of kind ${structured[1].kind}. Pass a ${structured[1].kind}, or declare the input as json.`
  }
  const { node, drawn } = expandTemplateInputs(template, inputs, values)
  const decoded = Schema.decodeUnknownExit(ComponentSchema)(asPageNode(node), { errors: 'first' })
  if (decoded._tag === 'Success') return undefined
  const error = decoded.cause.reasons.flatMap((reason) =>
    reason._tag === 'Fail' ? [reason.error] : []
  )[0]
  const culprit = culpritOf(error, drawn)
  const detail = decodeMessage(error)
  return culprit === undefined
    ? `${head} draws a component the page refuses: ${detail}`
    : `${head} passes the input '${culprit.input}' a value of the wrong shape for the field ${culprit.field} it fills: ${detail}`
}

/** Every placement violation on one page. */
const pageViolations = (
  page: unknown,
  templates: ReadonlyMap<string, Readonly<Record<string, unknown>>>
): readonly (string | undefined)[] => {
  if (!isRecord(page)) return []
  const name = typeof page['name'] === 'string' ? page['name'] : String(page['path'])
  const { components } = page
  return collectPlacements(components).flatMap((placement) => {
    const template = templates.get(placement.name)
    return template === undefined
      ? []
      : [placementViolation(name, placementLabel(placement, components), placement, template)]
  })
}

/**
 * Validate every template that declares inputs, and every page placement of one.
 *
 * @returns `true` when every input is written and passed as it may be, or the
 * message naming the first that is not.
 */
export const validateAllTemplateInputs = (app: AppForInputValidation): string | true => {
  const templates = inputTemplates(app.components)
  if (templates.size === 0) return true
  const templateErrors = [...templates].map(([name, template]) => embeddedViolation(name, template))
  const pages = Array.isArray(app.pages) ? app.pages : []
  const placementErrors = pages.flatMap((page: unknown) => pageViolations(page, templates))
  return [...templateErrors, ...placementErrors].find((error) => error !== undefined) ?? true
}
