/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement } from 'react'

/**
 * Props for rendering a component reference error
 */
interface ComponentReferenceErrorProps {
  readonly refName: string
  readonly components: Components | undefined
}

/**
 * Render an error message for missing component references
 */
export function renderComponentReferenceError({
  refName,
  components,
}: ComponentReferenceErrorProps): ReactElement {
  return (
    <div
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR error fallback; rendered only when a component reference is missing
      style={{
        padding: '1rem',
        border: '2px dashed red',
        color: 'red',
        fontFamily: 'monospace',
      }}
    >
      Component not found: &quot;{refName}&quot;
      <br />
      <small>Available components: {components?.map((b) => b.name).join(', ') || 'none'}</small>
    </div>
  )
}

/**
 * Extract reference name and vars from component reference
 */
export function extractComponentReference(
  component: SimpleComponentReference | ComponentReference
): {
  refName: string
  vars: Record<string, unknown> | undefined
} {
  const refName = 'component' in component ? component.component : component.$ref
  const vars = 'vars' in component ? (component.vars as Record<string, unknown>) : undefined
  const variables =
    'variables' in component
      ? (component as { variables: Record<string, unknown> }).variables
      : undefined
  return { refName, vars: variables ?? vars }
}

/**
 * Props for component reference rendering
 * @public
 */
export interface ComponentReferenceRenderProps {
  readonly component: Component
  readonly componentName: string
  readonly componentInstanceIndex: number | undefined
  readonly components: Components | undefined
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly currentLang: string | undefined
}
