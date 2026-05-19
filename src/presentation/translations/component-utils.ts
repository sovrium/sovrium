/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'

export function getComponentInfo(
  section: Component | SimpleComponentReference | ComponentReference,
  index: number,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
): { name: string; instanceIndex?: number } | undefined {
  if (!('component' in section || '$ref' in section)) {
    return undefined
  }

  const componentName = 'component' in section ? section.component : section.$ref

  const totalOccurrences = sections.filter((s) => {
    const sName = 'component' in s ? s.component : '$ref' in s ? s.$ref : undefined
    return sName === componentName
  }).length

  if (totalOccurrences <= 1) {
    return { name: componentName }
  }

  const previousOccurrences = sections.slice(0, index).filter((s) => {
    const sName = 'component' in s ? s.component : '$ref' in s ? s.$ref : undefined
    return sName === componentName
  })

  return { name: componentName, instanceIndex: previousOccurrences.length }
}
