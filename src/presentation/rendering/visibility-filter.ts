/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component-level visibility filtering for the page renderer.
 *
 * Extracted from `render-page.tsx` so the entry file stays under the
 * line cap. The two strategies are:
 *   - `condition` — fully exclude the component from the SSR output (the
 *     value never reaches the HTML for unauthorised users).
 *   - `when` / `roles` — render the component but inject `display: none`
 *     into its style prop (preserves DOM structure for client-side
 *     rehydration).
 *
 * Visibility config is read off `component.props.visibility`; the
 * declarative shape lives in the schema layer and is duck-typed here so
 * the renderer stays decoupled from the Effect Schema definitions.
 */

import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * Visibility config shape as stored in component props
 */
interface VisibilityCondition {
  readonly field: string
  readonly operator: 'eq' | 'neq'
  readonly value: string
}

interface VisibilityConfig {
  readonly when?: 'authenticated' | 'unauthenticated'
  readonly roles?: readonly string[]
  readonly condition?: VisibilityCondition
}

/**
 * Evaluates a field-based condition against the current session.
 *
 * Supports $user.* field references (e.g., $user.role, $user.plan).
 * Returns true if the condition is satisfied.
 */
function evaluateCondition(
  condition: VisibilityCondition,
  session: SessionInfo | undefined
): boolean {
  const { field, operator, value } = condition

  // Resolve field value from session ($user.* references only)
  const fieldValue =
    field.startsWith('$user.') && session !== undefined
      ? (session as unknown as Record<string, string | undefined>)[field.slice('$user.'.length)]
      : undefined

  if (operator === 'eq') return fieldValue === value
  if (operator === 'neq') return fieldValue !== value
  return false
}

/**
 * Checks if the session role satisfies the role requirements of a visibility config.
 */
function isRoleVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  if (!visibility.roles || visibility.roles.length === 0) return true
  if (session === undefined) return false
  return visibility.roles.includes(session.role)
}

/**
 * Determines if a section should be visible given the current session.
 */
function isSectionVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  const isAuthenticated = session !== undefined

  if (visibility.when === 'authenticated' && !isAuthenticated) return false
  if (visibility.when === 'unauthenticated' && isAuthenticated) return false
  if (!isRoleVisible(visibility, session)) return false
  if (visibility.condition !== undefined && !evaluateCondition(visibility.condition, session))
    return false

  return true
}

/**
 * Extracts visibility config from component props if present
 */
function extractVisibilityFromProps(
  props: Record<string, unknown> | undefined
): VisibilityConfig | undefined {
  if (!props || typeof props.visibility !== 'object' || props.visibility === null) return undefined
  return props.visibility as VisibilityConfig
}

/**
 * Returns true when visibility is purely condition-based (no when/roles).
 */
function isConditionOnlyVisibility(visibility: VisibilityConfig): boolean {
  return !visibility.when && (!visibility.roles || visibility.roles.length === 0)
}

/**
 * Applies visibility to a single section: either returns it unchanged,
 * or injects `display: none` into its style prop.
 */
function applyVisibilityToSection(
  section: Page['components'][number],
  session: SessionInfo | undefined
): Page['components'][number] {
  if ('component' in section || '$ref' in section) return section

  const component = section as Component
  const visibility = extractVisibilityFromProps(component.props)
  if (!visibility) return component

  if (isConditionOnlyVisibility(visibility)) return component

  if (isSectionVisible(visibility, session)) return component

  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      style: {
        ...((component.props?.style as Record<string, unknown> | undefined) ?? {}),
        display: 'none',
      },
    },
  }
}

/**
 * Applies visibility filtering to page sections based on the current session.
 */
export function applyVisibilityToComponents(
  components: Page['components'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components
    .filter((item) => {
      if ('component' in item || '$ref' in item) return true

      const component = item as Component
      const visibility = extractVisibilityFromProps(component.props)
      if (!visibility?.condition) return true

      return evaluateCondition(visibility.condition, session)
    })
    .map((item) => applyVisibilityToSection(item, session))
}
