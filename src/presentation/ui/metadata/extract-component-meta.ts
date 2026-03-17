/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentMeta } from './structured-data-from-component'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { Components } from '@/domain/models/app/components'
import type { OpenGraph } from '@/domain/models/app/page/meta/open-graph'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Substitutes variables in a string value
 *
 * @param value - String value with potential $variable placeholders
 * @param vars - Variables map
 * @returns String with variables substituted
 */
function substituteMetaVariables(
  value: string | undefined,
  vars: Record<string, string | number | boolean> | undefined
): string | undefined {
  if (!value || !vars) return value

  // Use reduce for functional approach instead of loop with mutation
  return Object.entries(vars).reduce(
    (result, [key, varValue]) => result.replace(new RegExp(`\\$${key}`, 'g'), String(varValue)),
    value
  )
}

/**
 * Extracts Open Graph meta from a component's meta configuration
 *
 * @param meta - Component meta configuration
 * @param vars - Variables for substitution
 * @returns Partial Open Graph configuration
 */
function extractOpenGraphFromComponentMeta(
  meta: ComponentMeta | undefined,
  vars: Record<string, string | number | boolean> | undefined
): Partial<OpenGraph> | undefined {
  if (!meta) return undefined

  // Build immutably without mutation
  const withImage = meta.image ? { image: substituteMetaVariables(meta.image, vars) } : {}

  const withTitle = meta.title ? { title: substituteMetaVariables(meta.title, vars) } : {}

  const withDescription = meta.description
    ? { description: substituteMetaVariables(meta.description, vars) }
    : {}

  const openGraph = {
    ...withImage,
    ...withTitle,
    ...withDescription,
  }

  return Object.keys(openGraph).length > 0 ? openGraph : undefined
}

/**
 * Extracts component meta from page sections
 *
 * Processes all sections to find component references, resolves them, and extracts
 * meta information that should be included in the page's Open Graph meta tags.
 *
 * @param sections - Page sections
 * @param components - Available component templates
 * @returns Merged Open Graph configuration from all components
 */
export function extractComponentMetaFromSections(
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  components?: Components
): Partial<OpenGraph> | undefined {
  if (!sections || !components) return undefined

  // Use functional map/filter instead of loop with mutation
  const openGraphParts = sections
    .filter(
      (section): section is SimpleComponentReference | ComponentReference =>
        'component' in section || '$ref' in section
    )
    .map((section) => {
      const componentName = 'component' in section ? section.component : section.$ref
      const vars = 'vars' in section ? section.vars : undefined

      // Find the component template definition
      const template = components.find((b) => b.name === componentName)
      if (!template?.props?.meta) return undefined

      // Extract Open Graph meta from component meta
      const meta = template.props.meta as ComponentMeta | undefined
      return extractOpenGraphFromComponentMeta(meta, vars)
    })
    .filter((og): og is Partial<OpenGraph> => og !== undefined)

  if (openGraphParts.length === 0) return undefined

  // Merge all Open Graph parts (last one wins for duplicate keys)
  return openGraphParts.reduce((acc, part) => ({ ...acc, ...part }), {})
}
