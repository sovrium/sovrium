/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { referenceNameOf } from '@/presentation/render/resolve/component-reference'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'

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
  // Keyed on the VALUE, not on the key: `specimen` declares a `component` field
  // holding a whole component, and the key test named its template
  // `[object Object]` — which then won over the node's own `data-testid`,
  // because `buildTestId` prefers a component name.
  // An EXPANDED reference (inlined by the page pipeline) is still the template
  // it was placed from, so it is named and counted exactly as the reference was.
  const componentName = referenceNameOf(section)
  if (componentName === undefined) {
    return undefined
  }

  // Count total occurrences of this component name in all sections
  const totalOccurrences = sections.filter((s) => referenceNameOf(s) === componentName).length

  // Only set instanceIndex if there are multiple instances
  if (totalOccurrences <= 1) {
    return { name: componentName }
  }

  // Count previous occurrences of the same component name
  const previousOccurrences = sections
    .slice(0, index)
    .filter((s) => referenceNameOf(s) === componentName)

  return { name: componentName, instanceIndex: previousOccurrences.length }
}
