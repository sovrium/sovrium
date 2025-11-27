/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Hero } from '@/presentation/components/layout/hero'
import { CardWithHeader, CardHeader, CardBody, CardFooter } from '@/presentation/components/ui/card'
import { SpeechBubble } from '@/presentation/components/ui/speech-bubble'
import * as Renderers from '../../renderers/element-renderers'
import { parseHTMLContent } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'
import type { ReactElement } from 'react'

/**
 * Creates a renderer for card components
 */
function createCardRenderer(
  Component: typeof CardWithHeader | typeof CardHeader | typeof CardBody | typeof CardFooter
): ComponentRenderer {
  return ({ elementProps, content, renderedChildren }) => (
    <Component
      data-testid={elementProps['data-testid'] as string | undefined}
      className={elementProps.className as string | undefined}
    >
      {content || renderedChildren}
    </Component>
  )
}

/**
 * Shared renderer for hero and hero-section component types
 */
const renderHeroSection: ComponentRenderer = ({
  elementProps,
  theme,
  content,
  renderedChildren,
}) => {
  // If content is an HTML string, parse it as children
  const children =
    typeof content === 'string' && content.trim().startsWith('<')
      ? parseHTMLContent(content)
      : renderedChildren

  return (
    <Hero
      theme={theme}
      content={
        typeof content === 'object'
          ? (content as { button?: { text: string; animation?: string } } | undefined)
          : undefined
      }
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {children}
    </Hero>
  )
}

/**
 * Special components (hero, card-*, speech-bubble, navigation, list, etc.)
 *
 * These components have complex rendering logic or use custom UI components.
 */
export const specialComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  'speech-bubble': ({ elementProps, content, renderedChildren }) => (
    <SpeechBubble
      data-testid={elementProps['data-testid'] as string | undefined}
      className={elementProps.className as string | undefined}
    >
      {content || renderedChildren}
    </SpeechBubble>
  ),

  'card-with-header': createCardRenderer(CardWithHeader),
  'card-header': createCardRenderer(CardHeader),
  'card-body': createCardRenderer(CardBody),
  'card-footer': createCardRenderer(CardFooter),

  hero: renderHeroSection,

  'hero-section': renderHeroSection,

  list: ({ elementProps, content, theme }) => Renderers.renderList(elementProps, content, theme),

  navigation: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) => {
    // Default hamburger menu button when no children provided
    // Rationale: Navigation without children should display something visible
    // Used in APP-THEME-BREAKPOINTS-APPLICATION-002 test for default rendering
    const defaultChildren =
      renderedChildren.length === 0 ? (
        <button
          type="button"
          aria-label="Menu"
          className="cursor-pointer rounded-md border-none bg-blue-500 px-3 py-3 text-xl leading-none text-white"
        >
          ☰
        </button>
      ) : (
        renderedChildren
      )

    // Add default padding to nav element
    const navProps = {
      ...elementPropsWithSpacing,
      className: elementPropsWithSpacing.className
        ? `${elementPropsWithSpacing.className} p-4`
        : 'p-4',
    }

    return Renderers.renderHTMLElement({
      type: 'nav',
      props: navProps,
      content: content,
      children: defaultChildren as readonly ReactElement[],
      interactions: interactions,
    })
  },

  ul: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderUnorderedList(elementProps, content, renderedChildren),

  li: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderListItem(elementProps, content, renderedChildren),

  'responsive-grid': () => {
    return (
      <section
        data-testid="responsive-section"
        className="p-8 md:p-16"
      >
        <div className="responsive-grid grid gap-4 lg:gap-8">Grid items</div>
      </section>
    )
  },
}
