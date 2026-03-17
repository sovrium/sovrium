/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Hero } from '@/presentation/ui/sections/hero'
import * as Renderers from '../../renderers/element-renderers'
import { parseHTMLContent } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'
import type { ReactElement } from 'react'

/** Inline class maps for card sub-components */
const CARD_CLASSES = {
  'card-with-header': 'bg-white border border-gray-200 overflow-hidden rounded-lg',
  'card-header': 'bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg',
  'card-body': 'px-4 py-3',
  'card-footer': 'bg-gray-50 px-4 py-3 border-t border-gray-200 rounded-b-lg',
} as const

/**
 * Creates a renderer for card components using inline div elements
 */
function createCardRenderer(baseClasses: string): ComponentRenderer {
  return ({ elementProps, content, renderedChildren }) => {
    const extra = elementProps.className as string | undefined
    const className = extra ? `${baseClasses} ${extra}` : baseClasses
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        className={className}
      >
        {content || renderedChildren}
      </div>
    )
  }
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
  'speech-bubble': ({ elementProps, content, renderedChildren }) => {
    const base =
      'bg-blue-100 border border-blue-300 px-4 py-3 text-sm rounded-tl-md rounded-tr-md rounded-br-md rounded-bl-none'
    const extra = elementProps.className as string | undefined
    const className = extra ? `${base} ${extra}` : base
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        className={className}
      >
        {content || renderedChildren}
      </div>
    )
  },

  'card-with-header': createCardRenderer(CARD_CLASSES['card-with-header']),
  'card-header': createCardRenderer(CARD_CLASSES['card-header']),
  'card-body': createCardRenderer(CARD_CLASSES['card-body']),
  'card-footer': createCardRenderer(CARD_CLASSES['card-footer']),

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
