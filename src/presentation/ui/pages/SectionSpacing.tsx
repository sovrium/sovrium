/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import { isCssValue, isTailwindClass } from '@/presentation/styling/style-utils'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'
import type { Theme } from '@/domain/models/app/theme'

function renderContainer(testId: string, value: string): ReactElement {
  return (
    <div
      data-testid={testId}
      {...(isTailwindClass(value) ? { className: value } : { style: { maxWidth: value } })}
    />
  )
}

function renderContainerElements(
  theme: Theme,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
): ReactElement | null {
  const hasContainer = sections.some(
    (s) =>
      'type' in s &&
      s.type === 'container' &&
      (!('element' in s) || s.element === undefined || s.element === 'div') &&
      (!('props' in s) || !(s.props as Record<string, unknown>)?.['data-testid'])
  )

  return (
    <>
      {theme?.spacing?.container &&
        !hasContainer &&
        renderContainer('container', theme.spacing.container)}

      {(() => {
        const containerSmall = (theme?.spacing as Record<string, unknown>)?.['container-small']
        if (typeof containerSmall === 'string') {
          return renderContainer('container-small', containerSmall)
        }
        return undefined
      })()}

      {(() => {
        const containerXSmall = (theme?.spacing as Record<string, unknown>)?.['container-xsmall']
        if (typeof containerXSmall === 'string') {
          return renderContainer('container-xsmall', containerXSmall)
        }
        return undefined
      })()}
    </>
  )
}

export function wrapWithSectionIfNeeded(
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  theme: Theme | undefined,
  children: ReactNode
): ReactElement {
  const hasSection = sections.some(
    (s) =>
      ('type' in s && s.type === 'section') ||
      ('type' in s && s.type === 'container' && 'element' in s && s.element === 'section')
  )
  const sectionSpacing = theme?.spacing?.section
  const shouldWrap = !hasSection && sectionSpacing

  if (!shouldWrap || !sectionSpacing) {
    return <>{children}</>
  }

  const useTailwind = !isCssValue(sectionSpacing)

  return (
    <section
      data-testid="section"
      {...(useTailwind && { className: sectionSpacing })}
      {...(!useTailwind && { style: { padding: sectionSpacing } })}
    >
      {children}
    </section>
  )
}

export function renderSectionWithSpacing(
  theme: Theme | undefined,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  children: ReactNode
): ReactElement {
  if (!theme?.spacing?.section && !theme?.spacing?.container) {
    return <>{children}</>
  }

  return (
    <>
      {wrapWithSectionIfNeeded(sections, theme, children)}
      {theme && renderContainerElements(theme, sections)}
    </>
  )
}
