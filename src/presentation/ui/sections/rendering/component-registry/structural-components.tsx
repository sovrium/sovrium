/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import {
  computeListItemClasses,
  computeTimelineContainerClasses,
  computeTimelineRailClasses,
} from '../../renderers/element-renderers/recipes/display-default-classes'
import {
  computeCardClasses,
  computeDividerLabelTextClasses,
  computeDividerLabelWrapperClasses,
  computeDividerRuleClasses,
} from '../../renderers/element-renderers/recipes/layout-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

/**
 * Structural HTML components (section, header, footer, main, etc.)
 *
 * These components render semantic HTML elements for page structure.
 */
export const structuralComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
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

  // Card — prestyled-by-default chip with bg + border + radius + shadow +
  // padding chrome. Author-supplied `props.className` appends LAST
  // so it wins at the Tailwind cascade (e.g. a grid cell tightening `p-4`
  // to `p-3`).
  card: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) => {
    const authorClassName = elementPropsWithSpacing['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeCardClasses(), authorClassName)
    return Renderers.renderHTMLElement({
      type: 'div',
      props: { ...elementPropsWithSpacing, className: mergedClassName },
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  // Timeline — structural-display container. Distinct from the
  // data-bound `data-timeline` Gantt island. Renders a vertical event list
  // with a left rail line; the rail is an absolute-positioned `<div>` so
  // it sits behind the children rendered to the right of `pl-6`.
  timeline: ({ elementPropsWithSpacing, content, renderedChildren, interactions }) => {
    const authorClassName = elementPropsWithSpacing['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeTimelineContainerClasses(), authorClassName)
    const children = (
      <>
        <div
          aria-hidden="true"
          className={computeTimelineRailClasses()}
        />
        {content}
        {renderedChildren}
      </>
    )
    return Renderers.renderHTMLElement({
      type: 'div',
      props: { ...elementPropsWithSpacing, className: mergedClassName },
      content: undefined,
      children: [children],
      interactions: interactions,
    })
  },

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

  // List-item — prestyled `<li>` row. The schema's action fields
  // promote a passive row to an interactive one; the `selected` and
  // `disabled` schema-level flags drive the state axis.
  'list-item': ({ elementProps, content, renderedChildren }) => {
    const interactive =
      Boolean(elementProps['onClick']) ||
      Boolean(elementProps['href']) ||
      elementProps['interactive'] === true
    const disabled = elementProps['disabled'] === true
    const selected = elementProps['selected'] === true
    const state = disabled ? 'disabled' : selected ? 'selected' : 'default'
    const authorClassName = elementProps['className'] as string | undefined
    const className = mergePrestyle(computeListItemClasses({ state, interactive }), authorClassName)
    return Renderers.renderListItem({ ...elementProps, className }, content, renderedChildren)
  },

  // Divider — renders an <hr> with prestyled `sv-border` color tone
  //. `style` (solid|dashed|dotted) maps to inline `borderStyle`
  // since that's a schema literal that shouldn't go through the token
  // cascade. `label` (when present) wraps the rule in an aria-separator
  // container with muted-fg label text so labelled separators read as
  // passive chrome.
  divider: ({ elementProps }) => {
    const style = elementProps['style'] as string | undefined
    const label = elementProps['label'] as string | undefined
    const borderStyle = style === 'dashed' || style === 'dotted' ? style : 'solid'
    const authorClassName = elementProps['className'] as string | undefined
    if (label) {
      const wrapperClassName = mergePrestyle(computeDividerLabelWrapperClasses(), authorClassName)
      const ruleClassName = `flex-1 ${computeDividerRuleClasses()}`
      return (
        <div
          {...elementProps}
          role="separator"
          aria-label={label}
          className={wrapperClassName}
        >
          <hr
            className={ruleClassName}
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only style derived from `style` prop literal
            style={{ borderStyle }}
          />
          <span className={computeDividerLabelTextClasses()}>{label}</span>
          <hr
            className={ruleClassName}
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only style derived from `style` prop literal
            style={{ borderStyle }}
          />
        </div>
      )
    }
    const ruleClassName = mergePrestyle(computeDividerRuleClasses(), authorClassName)
    return (
      <hr
        {...elementProps}
        className={ruleClassName}
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only style derived from `style` prop literal
        style={{ borderStyle }}
      />
    )
  },

  // Spacer — renders a div with a configurable height. `size` (sm/md/lg/xl)
  // maps to Tailwind h-* utilities; defaults to `md`.
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
