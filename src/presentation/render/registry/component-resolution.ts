/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
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
 * component field); the other four are re-derived with variable substitution.
 */
const EXPLICITLY_RESOLVED_KEYS: ReadonlySet<string> = new Set([
  'name',
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
