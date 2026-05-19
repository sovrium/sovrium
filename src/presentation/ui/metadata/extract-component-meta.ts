/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentMeta } from './structured-data-from-component'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

function substituteMetaVariables(
  value: string | undefined,
  vars: Record<string, string | number | boolean> | undefined
): string | undefined {
  if (!value || !vars) return value

  return Object.entries(vars).reduce(
    (result, [key, varValue]) => result.replace(new RegExp(`\\$${key}`, 'g'), String(varValue)),
    value
  )
}

function extractOpenGraphFromComponentMeta(
  meta: ComponentMeta | undefined,
  vars: Record<string, string | number | boolean> | undefined
): Partial<OpenGraph> | undefined {
  if (!meta) return undefined

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

export function extractComponentMetaFromSections(
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  components?: Components
): Partial<OpenGraph> | undefined {
  if (!sections || !components) return undefined

  const openGraphParts = sections
    .filter(
      (section): section is SimpleComponentReference | ComponentReference =>
        'component' in section || '$ref' in section
    )
    .map((section) => {
      const componentName = 'component' in section ? section.component : section.$ref
      const vars = 'vars' in section ? section.vars : undefined

      const template = components.find((b) => b.name === componentName)
      if (!template?.props?.meta) return undefined

      const meta = template.props.meta as ComponentMeta | undefined
      return extractOpenGraphFromComponentMeta(meta, vars)
    })
    .filter((og): og is Partial<OpenGraph> => og !== undefined)

  if (openGraphParts.length === 0) return undefined

  return openGraphParts.reduce((acc, part) => ({ ...acc, ...part }), {})
}
