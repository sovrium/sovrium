/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  substituteVariableValues,
  substituteChildrenVariables,
  substitutePropsVariables,
} from '../translations/variable-substitution'
import type { Components } from '@/domain/models/app/components'
import type { Component } from '@/domain/models/app/page/sections'

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
  vars?: Record<string, string | number | boolean>
): { readonly component: Component; readonly name: string } | undefined {
  const template = components?.find((b) => b.name === componentName)
  if (!template) {
    // DEVELOPMENT WARNING: Keep console.warn for development debugging
    // This warning alerts developers when a referenced component doesn't exist
    // Helps identify typos or missing component definitions during development
    // Safe to keep - provides helpful feedback for configuration errors
    console.warn(`Component not found: ${componentName}`)
    return undefined
  }

  // Cast template.children to Component children type for type compatibility
  const templateChildren = template.children as ReadonlyArray<Component | string> | undefined

  const component: Component = {
    type: template.type,
    props: substitutePropsVariables(template.props, vars),
    children: substituteChildrenVariables(templateChildren, vars),
    content:
      typeof template.content === 'string'
        ? (substituteVariableValues(template.content, vars) as string)
        : template.content,
  }

  return { component, name: template.name }
}
