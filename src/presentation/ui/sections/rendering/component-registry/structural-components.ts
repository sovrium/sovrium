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
 * Structural HTML components (section, header, footer, main, etc.)
 *
 * These components render semantic HTML elements for page structure.
 */
export const structuralComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  section: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'section',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  header: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'header',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  footer: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'footer',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  main: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'main',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  article: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'article',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  aside: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'aside',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  nav: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'nav',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  div: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  container: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  flex: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  grid: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  card: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  timeline: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  accordion: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  span: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'span',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  modal: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  sidebar: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  toast: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  fab: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  spinner: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  'list-item': ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  dropdown: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),
}
