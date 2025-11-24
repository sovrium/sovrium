/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { Hero } from '@/presentation/components/layout/hero'
import { convertBadgeProps } from '../props/element-props'
import * as Renderers from './element-renderers'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Renderer function signature
 */
type ComponentRenderer = (params: {
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly content?: string
  readonly renderedChildren: readonly ReactElement[]
  readonly theme?: Theme
  readonly languages?: Languages
  readonly interactions?: unknown
}) => ReactElement | null

/**
 * Creates a renderer that wraps content in an HTML element
 */
function createHTMLRenderer(tag: 'div' | 'span' | 'section'): ComponentRenderer {
  return ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: tag,
      props: elementPropsWithSpacing,
      content,
      children: renderedChildren,
      interactions,
    })
}

/**
 * Creates a renderer for heading elements
 */
function createHeadingRenderer(level: 1 | 2 | 3 | 4 | 5 | 6): ComponentRenderer {
  return ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderHeading(level, elementPropsWithSpacing, content, renderedChildren)
}

/**
 * Component type to renderer mapping
 *
 * Maps component types to their corresponding renderer functions.
 * Uses factory functions for common patterns to reduce duplication.
 */
const COMPONENT_RENDERERS: Readonly<Record<string, ComponentRenderer>> = {
  // Structural elements
  section: createHTMLRenderer('section'),
  div: createHTMLRenderer('div'),
  container: createHTMLRenderer('div'),
  flex: createHTMLRenderer('div'),
  grid: createHTMLRenderer('div'),
  card: createHTMLRenderer('div'),
  timeline: createHTMLRenderer('div'),
  accordion: createHTMLRenderer('div'),
  span: createHTMLRenderer('span'),
  modal: createHTMLRenderer('div'),
  sidebar: createHTMLRenderer('div'),
  toast: createHTMLRenderer('div'),
  fab: createHTMLRenderer('div'),
  spinner: createHTMLRenderer('div'),
  'list-item': createHTMLRenderer('div'),
  dropdown: createHTMLRenderer('div'),

  // Badge (with props conversion)
  badge: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) => {
    const badgeProps = convertBadgeProps(elementPropsWithSpacing)
    return Renderers.renderHTMLElement({
      type: 'span',
      props: badgeProps,
      content,
      children: renderedChildren,
      interactions,
    })
  },

  // Icon
  icon: ({ elementPropsWithSpacing, renderedChildren }) =>
    Renderers.renderIcon(elementPropsWithSpacing, renderedChildren),

  // Headings
  h1: createHeadingRenderer(1),
  h2: createHeadingRenderer(2),
  h3: createHeadingRenderer(3),
  h4: createHeadingRenderer(4),
  h5: createHeadingRenderer(5),
  h6: createHeadingRenderer(6),
  heading: createHeadingRenderer(1),

  // Content elements
  text: ({ elementPropsWithSpacing, content }) =>
    Renderers.renderTextElement(elementPropsWithSpacing, content),
  paragraph: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderParagraph(elementPropsWithSpacing, content, renderedChildren),
  p: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderParagraph(elementPropsWithSpacing, content, renderedChildren),
  code: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderCode(elementPropsWithSpacing, content, renderedChildren),
  pre: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderPre(elementPropsWithSpacing, content, renderedChildren),

  // Media elements
  image: ({ elementPropsWithSpacing }) => Renderers.renderImage(elementPropsWithSpacing),
  video: ({ elementPropsWithSpacing, renderedChildren }) =>
    Renderers.renderVideo(elementPropsWithSpacing, renderedChildren),
  audio: ({ elementPropsWithSpacing, renderedChildren }) =>
    Renderers.renderAudio(elementPropsWithSpacing, renderedChildren),
  iframe: ({ elementPropsWithSpacing, renderedChildren }) =>
    Renderers.renderIframe(elementPropsWithSpacing, renderedChildren),

  // Interactive elements
  button: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderButton(elementPropsWithSpacing, content, renderedChildren),
  link: ({ elementPropsWithSpacing, content, renderedChildren }) =>
    Renderers.renderLink(elementPropsWithSpacing, content, renderedChildren),
  alert: ({ elementPropsWithSpacing, content, renderedChildren, theme }) =>
    Renderers.renderAlert(elementPropsWithSpacing, content, renderedChildren, theme),
  form: ({ elementPropsWithSpacing, renderedChildren }) =>
    Renderers.renderForm(elementPropsWithSpacing, renderedChildren),
  input: ({ elementPropsWithSpacing }) => Renderers.renderInput(elementPropsWithSpacing),

  // Custom blocks
  customHTML: ({ elementPropsWithSpacing }) => Renderers.renderCustomHTML(elementPropsWithSpacing),
  'language-switcher': ({ elementPropsWithSpacing, languages }) =>
    Renderers.renderLanguageSwitcher(elementPropsWithSpacing, languages),

  // Layout components (React components)
  hero: ({ elementPropsWithSpacing, renderedChildren, theme }) => (
    <Hero
      theme={theme}
      data-testid={elementPropsWithSpacing['data-testid'] as string | undefined}
    >
      {renderedChildren}
    </Hero>
  ),

  list: ({ elementPropsWithSpacing, content, theme }) =>
    Renderers.renderList(elementPropsWithSpacing, content, theme),

  navigation: createHTMLRenderer('div'),
}

/**
 * Get renderer for component type
 *
 * @param type - Component type
 * @returns Renderer function or undefined if not found
 */
export function getRendererForType(type: Component['type']): ComponentRenderer | undefined {
  return COMPONENT_RENDERERS[type]
}

/**
 * Get fallback renderer for unknown types
 *
 * @returns Default div renderer
 */
export function getFallbackRenderer(): ComponentRenderer {
  return createHTMLRenderer('div')
}
