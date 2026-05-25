/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

export const structuralComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  container: ({ elementPropsWithSpacing, content, renderedChildren, interactions, component }) => {
    const element =
      ((component as Record<string, unknown> | undefined)?.element as
        | 'div'
        | 'section'
        | 'main'
        | 'aside'
        | 'nav'
        | 'header'
        | 'footer'
        | 'article'
        | undefined) ?? 'div'
    return Renderers.renderHTMLElement({
      type: element,
      props: elementPropsWithSpacing,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

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

  spinner: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  'list-item': ({ elementProps, content, renderedChildren }) =>
    Renderers.renderListItem(elementProps, content, renderedChildren),

  divider: ({ elementProps }) => {
    const style = elementProps['style'] as string | undefined
    const label = elementProps['label'] as string | undefined
    const borderStyle = style === 'dashed' || style === 'dotted' ? style : 'solid'
    if (label) {
      return (
        <div
          {...elementProps}
          role="separator"
          aria-label={label}
          className={`text-muted flex items-center gap-2 text-xs ${
            (elementProps['className'] as string | undefined) ?? ''
          }`}
        >
          <hr
            className="flex-1"
            style={{ borderStyle }}
          />
          <span>{label}</span>
          <hr
            className="flex-1"
            style={{ borderStyle }}
          />
        </div>
      )
    }
    return (
      <hr
        {...elementProps}
        style={{ borderStyle }}
      />
    )
  },

  spacer: ({ elementProps }) => {
    const size = elementProps['size'] as string | undefined
    const sizeClass =
      size === 'sm' ? 'h-2' : size === 'lg' ? 'h-12' : size === 'xl' ? 'h-20' : 'h-6'
    const userClassName = (elementProps['className'] as string | undefined) ?? ''
    return (
      <div
        aria-hidden="true"
        data-testid={elementProps['data-testid'] as string | undefined}
        className={`${sizeClass} ${userClassName}`}
      />
    )
  },
}
