/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  expandedReferenceOf,
  isComponentReferenceNode,
} from '@/presentation/render/resolve/component-reference'
import type { ComponentMeta } from './structured-data-from-component'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

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
 * The template a section was placed from, and the vars it was placed with.
 *
 * The VALUE, not the key — see `isComponentReferenceNode`. A `specimen` matched
 * the key test and then looked up a template named `[object Object]`, which
 * found nothing; correct output, wrong reason. An EXPANDED reference (inlined
 * by the page pipeline) still names its template and remembers its vars.
 */
function templateReferenceOf(
  section: Component | SimpleComponentReference | ComponentReference
): { readonly name: string; readonly vars: unknown } | undefined {
  const expanded = expandedReferenceOf(section)
  if (expanded !== undefined) return expanded
  if (!isComponentReferenceNode(section)) return undefined
  const reference = section as SimpleComponentReference | ComponentReference
  return 'component' in reference
    ? { name: reference.component, vars: 'vars' in reference ? reference.vars : undefined }
    : { name: reference.$ref, vars: reference.vars }
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
    .map((section) => {
      const reference = templateReferenceOf(section)
      if (reference === undefined) return undefined

      // Find the component template definition
      const template = components.find((b) => b.name === reference.name)
      if (!template?.props?.meta) return undefined

      // Extract Open Graph meta from component meta
      const meta = template.props.meta as ComponentMeta | undefined
      return extractOpenGraphFromComponentMeta(
        meta,
        reference.vars as Record<string, string | number | boolean> | undefined
      )
    })
    .filter((og): og is Partial<OpenGraph> => og !== undefined)

  if (openGraphParts.length === 0) return undefined

  // Merge all Open Graph parts (last one wins for duplicate keys)
  return openGraphParts.reduce((acc, part) => ({ ...acc, ...part }), {})
}
