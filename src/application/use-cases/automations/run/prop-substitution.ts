/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prop-substitution glue for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Fills in an
 * action's authored `$env.X` references and `{{...}}` templates before the
 * action handler sees them, and looks up named templates from `app.actions[]`.
 *
 * Every value is filled in ONCE. `$env.X` is resolved in the authored text
 * only, as a value the template pass inserts without parsing it (see
 * `../authored-references`), and the props a step hands to a nested action
 * (a code action's `context.actions` call, a loop body, a path branch) are
 * final: they are never rendered again.
 */

import {
  authoredReferenceRoots,
  fillAuthoredReferences,
  referenceAuthoredValues,
} from '../authored-references'
import { buildAutomationContext, resolveTriggerInValue } from '../resolve-trigger-data'
import type { AuthoredReferenceValues } from '../authored-references'
import type { RuntimeActionTemplate, StepContext } from './types'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'

/**
 * Locate a named template entry in `app.actions[]`. Returns undefined when
 * no template by that name is declared.
 */
export const findTemplate = (app: App, name: string): RuntimeActionTemplate | undefined =>
  (app.actions as ReadonlyArray<RuntimeActionTemplate> | undefined)?.find((t) => t.name === name)

/**
 * Prepare AUTHORED config text — an action's props as written in the app
 * config, or a named template's body — for the template pass: its `$env.X`
 * (and, in a template, `$name`) references become values the pass inserts
 * without reading them. A value a template later brings in from outside (a
 * webhook body, a form submission, a record field, a step output) is never
 * scanned for `$env.`: a caller who sends `$env.SECRET_TOKEN` gets those
 * characters back, not the secret.
 */
export const referenceAuthoredProps = <A>(
  authored: A,
  ctx: Pick<StepContext, 'envLookup'>,
  vars?: AuthoredReferenceValues['vars']
): A => referenceAuthoredValues(authored, { envLookup: ctx.envLookup, vars })

/**
 * Render a named template's authored props for handler dispatch, once,
 * against the run's template context. `code` actions skip this pass: their
 * handler renders `inputData` against its own context, and their source is
 * never a template.
 */
export const renderAuthoredTemplateProps = (
  action: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): Readonly<Record<string, unknown>> => {
  const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
  return String(action['type'] ?? '') === 'code'
    ? props
    : (resolveTriggerInValue(props, context, templates) as Record<string, unknown>)
}

/** The props of a code action invoked with values: its source is never a template. */
const fillCodeProps = (
  props: Readonly<Record<string, unknown>>,
  values: AuthoredReferenceValues,
  context: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): Readonly<Record<string, unknown>> => {
  const { inputData, ...rest } = props
  const filled = fillAuthoredReferences(rest, { envLookup: values.envLookup })
  return inputData === undefined
    ? filled
    : {
        ...filled,
        inputData: resolveTriggerInValue(
          referenceAuthoredValues(inputData, values),
          context,
          templates
        ),
      }
}

/**
 * Fill an action template a caller invokes directly with arguments (an MCP
 * action tool) ONCE, into the action the run then executes with its props
 * FINAL: no step resolves `$env.` or renders `{{...}}` in them again.
 *
 * The template is authored config, prepared as a named template is: `$env.X`
 * and the template's `$name` variables become values the single template pass
 * inserts without parsing them. `{{name}}` reads an argument by name, and
 * `{{trigger.data.name}}` the same argument. A `$name` reads only a declared
 * parameter (`parameterNames`) over the template's `variables` defaults, so an
 * undeclared argument cannot stand in for a reference the engine resolves
 * later (`$currentUser`). A code action's source is never a template: only
 * its env references are filled in, and arguments reach it through
 * `inputData`.
 *
 * The text the template engine compiles is therefore the configuration as
 * written, never an argument.
 */
export const fillInvokedTemplateAction = (input: {
  readonly template: RuntimeActionTemplate
  readonly args: Readonly<Record<string, unknown>>
  readonly parameterNames: ReadonlyArray<string>
  readonly envLookup: Readonly<Record<string, string>>
  readonly templates: TemplateRenderer
}): Readonly<Record<string, unknown>> => {
  const { template, args, envLookup, templates } = input
  const defaults = fillAuthoredReferences(template.variables ?? {}, { envLookup })
  const declared = Object.fromEntries(
    Object.entries(args).filter(([name]) => input.parameterNames.includes(name))
  )
  const values: AuthoredReferenceValues = { envLookup, vars: { ...defaults, ...declared } }
  // Written last, so no argument shadows the trigger view or the two roots.
  const context = {
    ...defaults,
    ...args,
    ...buildAutomationContext({ body: args }),
    ...authoredReferenceRoots(values),
  }
  const props = (template.action['props'] as Record<string, unknown> | undefined) ?? {}
  const filled =
    String(template.action['type'] ?? '') === 'code'
      ? fillCodeProps(props, values, context, templates)
      : (resolveTriggerInValue(
          referenceAuthoredValues(props, values),
          context,
          templates
        ) as Readonly<Record<string, unknown>>)
  return { ...template.action, props: filled }
}
