/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import { isCssValue, isTailwindClass } from '@/presentation/styling/style-utils'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

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
 * Render optional container elements based on theme spacing
 *
 * @param theme - Theme configuration
 * @param sections - Sections to check for existing containers
 * @returns Container elements or undefined
 */
function renderContainerElements(
  theme: Theme,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
): ReactElement | null {
  const hasContainer = sections.some((s) => 'type' in s && s.type === 'container')

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

/**
 * Wrap sections in a section element if needed
 *
 * @param sections - Sections to check
 * @param theme - Theme configuration
 * @param children - Content to wrap
 * @returns Section-wrapped content or fragment with children
 */
export function wrapWithSectionIfNeeded(
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  theme: Theme | undefined,
  children: ReactNode
): ReactElement {
  const hasSection = sections.some((s) => 'type' in s && s.type === 'section')
  const sectionSpacing = theme?.spacing?.section
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
 * @param theme - Theme configuration
 * @param sections - Sections to render
 * @param children - Pre-rendered section content
 * @returns Section with spacing applied
 */
export function renderSectionWithSpacing(
  theme: Theme | undefined,
  sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>,
  children: ReactNode
): ReactElement {
  // No theme spacing - render directly
  if (!theme?.spacing?.section && !theme?.spacing?.container) {
    // eslint-disable-next-line react/jsx-no-useless-fragment -- Required to return ReactElement
    return <>{children}</>
  }

  return (
    <>
      {wrapWithSectionIfNeeded(sections, theme, children)}
      {theme && renderContainerElements(theme, sections)}
    </>
  )
}
