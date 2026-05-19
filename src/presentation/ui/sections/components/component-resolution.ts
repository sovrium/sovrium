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
} from '../translations/variable-substitution'
import type { Components } from '@/domain/models/app/components'
import type { Component } from '@/domain/models/app/pages/components'

export function resolveComponent(
  componentName: string,
  components?: Components,
  vars?: Record<string, unknown>
): { readonly component: Component; readonly name: string } | undefined {
  const template = components?.find((b) => b.name === componentName)
  if (!template) {
    console.warn(`Component not found: ${componentName}`)
    return undefined
  }

  const templateChildren = template.children as ReadonlyArray<Component | string> | undefined

  const component: Component = {
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
