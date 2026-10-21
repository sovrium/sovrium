/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withInputsInSchemaOrder } from '@/domain/models/app/pages/template-input-order-service'
import {
  expandTemplateInputs,
  substitutableInputsOf,
} from '@/domain/models/app/pages/template-input-service'
import {
  substituteActiveMarker,
  substituteVariableValues,
  substituteChildrenVariables,
  substitutePropsVariables,
} from '../i18n/variable-substitution'
import type { Components } from '@/domain/models/app/components'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Template keys this resolver builds explicitly below. Everything else the
 * template declares is passed through verbatim.
 *
 * `name` is template-only metadata (it becomes the returned `name`, never a
 * component field), as are `render` and `inputs`, which say how the template
 * is placed and travel on the expansion marker instead; the other four are
 * re-derived with variable substitution.
 */
const EXPLICITLY_RESOLVED_KEYS: ReadonlySet<string> = new Set([
  'name',
  'render',
  'inputs',
  'type',
  'element',
  'props',
  'children',
  'content',
])

/**
 * Resolves a component reference to a Component with optional variable substitution
 *
 * Pure function that finds a component template by name, converts it to a Component,
 * and applies variable substitution if vars are provided.
 *
 * @param componentName - Name of the component template to resolve
 * @param components - Array of available component templates
 * @param vars - Optional variables for substitution
 * @returns Resolved component and name, or undefined if not found
 *
 * @example
 * ```typescript
 * const components = [
 *   { name: 'hero', type: 'section', content: '$title' }
 * ]
 * const resolved = resolveComponent('hero', components, { title: 'Welcome' })
 * // { component: { type: 'section', content: 'Welcome' }, name: 'hero' }
 * ```
 */
export function resolveComponent(
  componentName: string,
  components?: Components,
  vars?: Record<string, unknown>
): { readonly component: Component; readonly name: string } | undefined {
  const template = components?.find((b) => b.name === componentName)
  if (!template) {
    // DEVELOPMENT WARNING: Keep console.warn for development debugging
    // This warning alerts developers when a referenced component doesn't exist
    // Helps identify typos or missing component definitions during development
    // Safe to keep - provides helpful feedback for configuration errors
    // eslint-disable-next-line no-console -- SSR component (presentation-component) cannot import the infrastructure Logger per layer boundaries; dev-only config warning
    console.warn(`Component not found: ${componentName}`)
    return undefined
  }

  const inputs = substitutableInputsOf(template)
  if (inputs !== undefined) {
    return { component: resolveWithInputs(template, inputs, vars), name: template.name }
  }

  // Cast template.children to Component children type for type compatibility
  const templateChildren = template.children as ReadonlyArray<Component | string> | undefined

  // A component template is the FULL component union plus `name`, so its
  // type-specific fields live at the TOP level beside `props`: a
  // `navigation-menu` template carries `navItems`, a `dropdown-menu` carries
  // `menuItems`/`triggerLabel`, a `table` carries its columns. Building
  // the resolved component from a fixed five-key list silently dropped every
  // one of them, so `{ component: 'main-nav' }` rendered an EMPTY menu while
  // the identical inline component rendered its links — the reference lost the
  // data, not the schema. Carry the rest of the template through verbatim.
  //
  // Verbatim, not substituted: `substituteVariableValues` only rewrites
  // strings, and walking arbitrary type-specific structures for `$var`
  // placeholders is a separate contract from the `props`/`children`/`content`
  // substitution below.
  const passthroughFields = Object.fromEntries(
    Object.entries(template as Record<string, unknown>).filter(
      ([key]) => !EXPLICITLY_RESOLVED_KEYS.has(key)
    )
  )

  const component: Component = {
    ...passthroughFields,
    // The current-item marker compares the placement's vars, so it takes them.
    ...substituteActiveMarker(template, vars),
    type: template.type,
    ...('element' in template && template.element !== undefined
      ? { element: template.element }
      : {}),
    props: substitutePropsVariables(template.props, vars),
    children: substituteChildrenVariables(templateChildren, vars),
    content:
      typeof template.content === 'string'
        ? (substituteVariableValues(template.content, vars) as string)
        : template.content,
  }

  return { component, name: template.name }
}

/**
 * Each placement's expansion, by template and by the placement's own values.
 * Both are the decoded config's objects, the same on every render, so a page's
 * placements are expanded (and their values decoded) once, not on every request.
 */
const expansions = new WeakMap<object, WeakMap<object, Component>>()

/**
 * A template that declares `inputs`: ONE pass over every field, for the
 * declared names only (see `template-input-service`). The text between them
 * keeps the substitution every template has, with the placement's undeclared
 * values, so an undeclared `$token` reads as it always did, and nothing a value
 * inserts is read a second time. Each value passed whole is then put in the
 * order the page schema writes its keys (`template-input-order-service`), so
 * the placement draws exactly what the same tree written inline draws.
 */
function resolveWithInputs(
  template: Components[number],
  inputs: NonNullable<ReturnType<typeof substitutableInputsOf>>,
  vars: Record<string, unknown> | undefined
): Component {
  const cached = vars === undefined ? undefined : expansions.get(template)?.get(vars)
  if (cached !== undefined) return cached
  const undeclared = Object.fromEntries(
    Object.entries(vars ?? {}).filter(([name]) => !inputs.has(name))
  )
  const { node, drawn } = expandTemplateInputs(
    template as Record<string, unknown>,
    inputs,
    vars,
    (text) => substituteVariableValues(text, undeclared) as string
  )
  const component = Object.fromEntries(
    Object.entries(withInputsInSchemaOrder(node, drawn)).filter(
      ([key]) => key !== 'name' && key !== 'render' && key !== 'inputs'
    )
  ) as Component
  if (vars !== undefined) {
    const byVars = expansions.get(template) ?? new WeakMap<object, Component>()
    byVars.set(vars, component)
    expansions.set(template, byVars)
  }
  return component
}
