/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CONTAINER_TYPES } from '../component-renderer.types'
import { buildFlexClasses, buildGridClasses } from '../styling/class-builders'
import type { Component } from '@/domain/models/app/pages/components'

export function buildTestId(
  componentName?: string,
  componentInstanceIndex?: number,
  type?: string,
  substitutedProps?: Record<string, unknown>
): string | undefined {
  if (componentName) {
    return componentInstanceIndex !== undefined
      ? `component-${componentName}-${componentInstanceIndex}`
      : `component-${componentName}`
  }

  const dataTestId = substitutedProps?.['data-testid']
  if (typeof dataTestId === 'string') {
    return dataTestId
  }

  if (type === 'container') return 'container'
  if (type === 'flex') return 'flex'
  if (type === 'text') return 'text'

  return undefined
}

const COMPONENT_TYPES_WITH_CSS_CLASSES = new Set(['card', 'badge'])

export function buildClassName(
  type: string,
  substitutedProps?: Record<string, unknown>
): string | undefined {
  if (type === 'flex') {
    return [buildFlexClasses(substitutedProps), substitutedProps?.className]
      .filter(Boolean)
      .join(' ')
  }

  if (type === 'grid') {
    return [buildGridClasses(substitutedProps), substitutedProps?.className]
      .filter(Boolean)
      .join(' ')
  }

  if (COMPONENT_TYPES_WITH_CSS_CLASSES.has(type)) {
    return [type, substitutedProps?.className].filter(Boolean).join(' ')
  }

  return substitutedProps?.className as string | undefined
}

function buildComponentDataAttrs(componentName?: string, type?: string) {
  if (!componentName) {
    return {}
  }
  return {
    'data-component': componentName,
    'data-type': type,
  }
}

function buildTranslationDataAttrs(
  firstTranslationKey?: string,
  translationData?: Record<string, unknown>
) {
  if (!firstTranslationKey || !translationData) {
    return {}
  }
  return {
    'data-translation-key': firstTranslationKey,
    'data-translations': JSON.stringify(translationData),
  }
}

function buildEmptyStyle(
  componentName?: string,
  type?: string,
  hasContent?: boolean,
  styleWithShadow?: Record<string, unknown>
) {
  if (componentName && !hasContent) {
    return {
      ...styleWithShadow,
      minHeight: '1px',
      minWidth: '1px',
      display: 'inline-block',
    }
  }
  if (!componentName && type === 'grid' && !hasContent) {
    return {
      ...styleWithShadow,
      minHeight: '100px',
      minWidth: '100px',
    }
  }
  return styleWithShadow
}

export function buildElementProps({
  component,
  substitutedProps,
  finalClassName,
  styleWithShadow,
  testId,
  componentName,
  firstTranslationKey,
  translationData,
  hasScrollAnimation,
  hasContent,
  children,
}: {
  readonly component: Component
  readonly substitutedProps?: Record<string, unknown>
  readonly finalClassName?: string
  readonly styleWithShadow?: Record<string, unknown>
  readonly testId?: string
  readonly componentName?: string
  readonly firstTranslationKey?: string
  readonly translationData?: Record<string, unknown>
  readonly hasScrollAnimation?: boolean
  readonly hasContent?: boolean
  readonly children?: readonly (Component | string)[]
}): Record<string, unknown> {
  const { type } = component
  const hasChildren = Boolean(children?.length)
  const finalStyle = buildEmptyStyle(componentName, type, hasContent, styleWithShadow)

  return {
    ...substitutedProps,
    className: finalClassName,
    ...(finalStyle && { style: finalStyle }),
    ...(testId && { 'data-testid': testId }),
    ...buildComponentDataAttrs(componentName, type),
    ...(componentName && hasChildren && CONTAINER_TYPES.includes(type) && { role: 'group' }),
    ...buildTranslationDataAttrs(firstTranslationKey, translationData),
    ...(hasScrollAnimation && { 'data-scroll-animation': 'scale-up' }),
  }
}

export { convertBadgeProps } from './prop-conversion'
