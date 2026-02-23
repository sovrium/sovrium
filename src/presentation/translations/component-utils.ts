/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Get component information for a section
 *
 * Determines if a section is a component reference and calculates its instance index
 * when multiple instances of the same component exist.
 *
 * @param section - Section to analyze (Component, SimpleComponentReference, or ComponentReference)
 * @param index - Position of this section in the sections array
 * @param sections - Complete array of sections for counting occurrences
 * @returns Component info with name and optional instanceIndex, or undefined if not a component reference
 */
export function getComponentInfo(
  section: Component | SimpleComponentReference | ComponentReference,
  index: number,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
): { name: string; instanceIndex?: number } | undefined {
  if (!('component' in section || '$ref' in section)) {
    return undefined
  }

  const componentName = 'component' in section ? section.component : section.$ref

  // Count total occurrences of this component name in all sections
  const totalOccurrences = sections.filter((s) => {
    const sName = 'component' in s ? s.component : '$ref' in s ? s.$ref : undefined
    return sName === componentName
  }).length

  // Only set instanceIndex if there are multiple instances
  if (totalOccurrences <= 1) {
    return { name: componentName }
  }

  // Count previous occurrences of the same component name
  const previousOccurrences = sections.slice(0, index).filter((s) => {
    const sName = 'component' in s ? s.component : '$ref' in s ? s.$ref : undefined
    return sName === componentName
  })

  return { name: componentName, instanceIndex: previousOccurrences.length }
}
