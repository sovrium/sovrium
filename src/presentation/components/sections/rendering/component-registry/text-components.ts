/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Text and heading components (h1-h6, text, paragraph, code, etc.)
 *
 * These components render text content and typography elements.
 */
export const textComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  h1: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(1, elementProps, content, renderedChildren),

  h2: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(2, elementProps, content, renderedChildren),

  h3: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(3, elementProps, content, renderedChildren),

  h4: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(4, elementProps, content, renderedChildren),

  h5: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(5, elementProps, content, renderedChildren),

  h6: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(6, elementProps, content, renderedChildren),

  heading: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderHeading(1, elementProps, content, renderedChildren),

  text: ({ elementProps, content }) => Renderers.renderTextElement(elementProps, content),

  'single-line-text': ({ elementProps, content }) =>
    Renderers.renderTextElement(elementProps, content),

  'long-text': ({ elementProps, content }) => Renderers.renderTextElement(elementProps, content),

  paragraph: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderParagraph(elementProps, content, renderedChildren),

  p: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderParagraph(elementProps, content, renderedChildren),

  code: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderCode(elementProps, content, renderedChildren),

  pre: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderPre(elementProps, content, renderedChildren),
}
