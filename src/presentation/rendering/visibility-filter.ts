/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SessionInfo } from '@/domain/types/session-info'

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

function evaluateCondition(
  condition: VisibilityCondition,
  session: SessionInfo | undefined
): boolean {
  const { field, operator, value } = condition

  const fieldValue =
    field.startsWith('$user.') && session !== undefined
      ? (session as unknown as Record<string, string | undefined>)[field.slice('$user.'.length)]
      : undefined

  if (operator === 'eq') return fieldValue === value
  if (operator === 'neq') return fieldValue !== value
  return false
}

function isRoleVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  if (!visibility.roles || visibility.roles.length === 0) return true
  if (session === undefined) return false
  return visibility.roles.includes(session.role)
}

function isSectionVisible(visibility: VisibilityConfig, session: SessionInfo | undefined): boolean {
  const isAuthenticated = session !== undefined

  if (visibility.when === 'authenticated' && !isAuthenticated) return false
  if (visibility.when === 'unauthenticated' && isAuthenticated) return false
  if (!isRoleVisible(visibility, session)) return false
  if (visibility.condition !== undefined && !evaluateCondition(visibility.condition, session))
    return false

  return true
}

function extractVisibilityFromProps(
  props: Record<string, unknown> | undefined
): VisibilityConfig | undefined {
  if (!props || typeof props.visibility !== 'object' || props.visibility === null) return undefined
  return props.visibility as VisibilityConfig
}

function isConditionOnlyVisibility(visibility: VisibilityConfig): boolean {
  return !visibility.when && (!visibility.roles || visibility.roles.length === 0)
}

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
