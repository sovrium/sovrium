/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import { isCssValue, isTailwindClass } from '@/presentation/render/styling/style-utils'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Render a container div with spacing
 *
 * @param testId - Data testid for the container
 * @param value - Spacing value (Tailwind class or CSS value)
 * @returns Container div element
 */
function renderContainer(testId: string, value: string): ReactElement {
  return (
    <div
      data-testid={testId}
      {...(isTailwindClass(value) ? { className: value } : { style: { maxWidth: value } })}
    />
  )
}

/**
 * Render optional container elements based on design spacing
 *
 * @param design - Design configuration
 * @param sections - Sections to check for existing containers
 * @returns Container elements or undefined
 */
function renderContainerElements(
  design: Design,
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
      {design?.spacing?.container &&
        !hasContainer &&
        renderContainer('container', design.spacing.container)}

      {(() => {
        const containerSmall = (design?.spacing as Record<string, unknown>)?.['container-small']
        if (typeof containerSmall === 'string') {
          return renderContainer('container-small', containerSmall)
        }
        return undefined
      })()}

      {(() => {
        const containerXSmall = (design?.spacing as Record<string, unknown>)?.['container-xsmall']
        if (typeof containerXSmall === 'string') {
          return renderContainer('container-xsmall', containerXSmall)
        }
        return undefined
      })()}
    </>
  )
}

/**
 * Wrap sections in a section element if needed
 *
 * @param sections - Sections to check
 * @param design - Design configuration
 * @param children - Content to wrap
 * @returns Section-wrapped content or fragment with children
 */
export function wrapWithSectionIfNeeded(
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  design: Design | undefined,
  children: ReactNode
): ReactElement {
  const hasSection = sections.some(
    (s) =>
      ('type' in s && s.type === 'section') ||
      ('type' in s && s.type === 'container' && 'element' in s && s.element === 'section')
  )
  const sectionSpacing = design?.spacing?.section
  const shouldWrap = !hasSection && sectionSpacing

  if (!shouldWrap || !sectionSpacing) {
    // eslint-disable-next-line react/jsx-no-useless-fragment -- Required to return ReactElement
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

/**
 * Render complete section with spacing wrappers
 *
 * @param design - Design configuration
 * @param sections - Sections to render
 * @param children - Pre-rendered section content
 * @returns Section with spacing applied
 */
export function renderSectionWithSpacing(
  design: Design | undefined,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  children: ReactNode
): ReactElement {
  // No design spacing - render directly
  if (!design?.spacing?.section && !design?.spacing?.container) {
    // eslint-disable-next-line react/jsx-no-useless-fragment -- Required to return ReactElement
    return <>{children}</>
  }

  return (
    <>
      {wrapWithSectionIfNeeded(sections, design, children)}
      {design && renderContainerElements(design, sections)}
    </>
  )
}
