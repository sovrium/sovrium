/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment } from 'react'
import {
  computeListItemClasses,
  computeSpeechBubbleClasses,
  computeTimelineContainerClasses,
  computeTimelineRailClasses,
} from '../../design/display-default-classes'
import {
  computeSpinnerClasses,
  computeSpinnerGlyphClasses,
} from '../../design/feedback-default-classes'
import {
  computeCardClasses,
  computeDividerLabelTextClasses,
  computeDividerLabelWrapperClasses,
  computeDividerRuleClasses,
} from '../../design/layout-default-classes'
import { resolveClasses } from '../../design/resolve-classes'
import {
  computeSidebarRailBoxClasses,
  type SidebarRailBreakpoint,
} from '../../design/sidebar-default-classes'
import * as Renderers from '../elements'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { DESIGN_SCOPE_ATTRIBUTE } from './design-components'
import { mergePrestyle } from './interactive-prestyle-builders'
import { recordBoundTimelineComponent } from './island-data-components'
import { renderSidebarGroups } from './sidebar-groups'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { SidebarGroup } from '@/domain/models/app/pages/components/component-types/layout/sidebar'

/**
 * Structural HTML components (section, header, footer, main, etc.)
 *
 * These components render semantic HTML elements for page structure.
 */
/**
 * The marker a repeating container carries into the browser.
 *
 * Spelled LITERALLY on both sides of the SSR boundary — here, and in
 * `presentation/islands/overlays/record-drawer-repeat.ts`, which reads it — for
 * the reason `data-island` and `data-drawer-children` already are: the render
 * tree and the island tree may not import each other, so a shared constant would
 * have to be hoisted into `design/`, which is for class recipes. Two spellings
 * and a cross-reference in each, as elsewhere.
 */
const REPEAT_ATTRIBUTE = 'data-repeat-record'

/**
 * The field a container asked to iterate, or `undefined` for the 30-odd
 * containers on a page that asked for nothing.
 *
 * Emitting the marker only where `repeat` was authored is what keeps the key
 * ADDITIVE: a container without it renders byte-for-byte what it did before
 * this attribute existed, which is the control `-REPEAT-003` pins.
 *
 * WHERE a `repeat` may legally stand is not decided here. `repeatPlacementViolations`
 * refuses one outside a record-bound drawer's slot at DECODE, so by the time this
 * renderer runs the only surviving markers are inside a slot the island owns.
 */
function containerRepeatField(component: unknown): string | undefined {
  const repeat = (component as Record<string, unknown> | undefined)?.['repeat']
  if (typeof repeat !== 'object' || repeat === null) return undefined
  const field = (repeat as Record<string, unknown>)['record']
  return typeof field === 'string' && field.length > 0 ? field : undefined
}

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
    const repeatField = containerRepeatField(component)
    return Renderers.renderHTMLElement({
      type: element,
      props:
        repeatField === undefined
          ? elementPropsWithSpacing
          : { ...elementPropsWithSpacing, [REPEAT_ATTRIBUTE]: repeatField },
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
  // padding chrome. Author-supplied `props.className` is merged in
  // via `resolveClasses`, so it wins same-property conflicts (e.g. a grid cell
  // tightening `p-4`
  // to `p-3`).
  //
  // THREE VARIANTS BRANCH HERE, and each was its own component type until the
  // catalogue reshape. `bubble` was `speech-bubble`; `scoped` was the design
  // boundary; `specimen` is the stage a drawn component sits on. The dispatch
  // is in the renderer rather than the registry because the registry is keyed
  // by `type` and all four are now one type.
  card: (context) => {
    const { elementPropsWithSpacing, content, renderedChildren, interactions, component } = context
    const variant = (component as { variant?: unknown } | undefined)?.variant
    const authorClassName = elementPropsWithSpacing['className'] as string | undefined

    // `bubble` — the tail side flips the sharp corner between sender (left,
    // the default) and receiver (right). Read from the component and from
    // `props`, because `speech-bubble` read it off `elementProps` and configs
    // written against it put it there.
    if (variant === 'bubble') {
      const declared =
        (component as { side?: unknown } | undefined)?.side ?? elementPropsWithSpacing['side']
      const side = declared === 'right' ? 'right' : 'left'
      return (
        <div
          data-testid={elementPropsWithSpacing['data-testid'] as string | undefined}
          className={mergePrestyle(computeSpeechBubbleClasses({ side }), authorClassName)}
        >
          {content || renderedChildren}
        </div>
      )
    }

    // `scoped` — the boundary the operator's design paints inside. The children
    // go INSIDE it and not beside it: a scope emitting the attribute next to
    // its children would satisfy "the attribute is present" and scope nothing.
    //
    // BARE, unlike its two sibling variants: `replaceDefaults` drops the card
    // recipe, so this paints no background, border, radius or padding. A scope
    // is a BOUNDARY, not a surface — and the recipe is not merely superfluous
    // here, it is actively wrong. Its three surface reads (`--sv-bg-raised`,
    // `--sv-border`, `--radius-md`) are re-declared INSIDE the scope by the
    // documented design, so a scoped card wearing the recipe frames whatever it
    // documents in that design's own colours: a raised, bordered box nobody
    // authored and no config can switch off.
    //
    // `replaceDefaults` rather than dropping `className`, because "bare" means
    // "no recipe", not "no classes". The author channel survives — and so does
    // the inert `card` marker `style-processor.ts` writes from
    // `COMPONENT_TYPE_CLASS_MAP`, which arrives here already merged into
    // `authorClassName`. Its `@layer components` rule was retired, so it paints
    // nothing, but removing the CLASS is not cascade-safe (see
    // `css/styles/component-layer-generators.ts`).
    if (variant === 'scoped') {
      return (
        <div
          {...omitInternalMarkers(elementPropsWithSpacing)}
          className={mergePrestyle(computeCardClasses(), authorClassName, true)}
          {...{ [DESIGN_SCOPE_ATTRIBUTE]: '' }}
        >
          {renderedChildren}
        </div>
      )
    }

    // `specimen` — a card with a stage. The stage is what a reader's eye and a
    // spec's locator both need: the drawing is one element, distinguishable
    // from the caption beside it. The specimen's IDENTITY attributes
    // (`data-design-specimen*`) are authored in config `props` and pass through
    // untouched, so nothing here needs to know what is being drawn.
    if (variant === 'specimen') {
      return (
        <div
          {...omitInternalMarkers(elementPropsWithSpacing)}
          className={mergePrestyle(computeCardClasses(), authorClassName)}
        >
          <div data-specimen-stage="">{content || renderedChildren}</div>
        </div>
      )
    }

    return Renderers.renderHTMLElement({
      type: 'div',
      props: {
        ...elementPropsWithSpacing,
        className: mergePrestyle(computeCardClasses(), authorClassName),
      },
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  // Timeline — structural-display container. Distinct from the
  // data-bound `data-timeline` Gantt island. Renders a vertical event list
  // with a left rail line; the rail is an absolute-positioned `<div>` so
  // it sits behind the children rendered to the right of `pl-6`.
  // TWO SHAPES, ONE TYPE. A `timeline` carrying a `dataSource` is the
  // record-bound Gantt and mounts its island; one without renders its authored
  // children as a rail with markers and mounts nothing. `data-timeline` was its
  // own type until the merge, and the binding — not a mode flag — is what
  // decides, so the two cannot disagree.
  //
  // Declaring both is REFUSED at decode rather than resolved here: the binding
  // would win and the author's children would vanish with no visible symptom.
  // See `component-xor-rules.ts`.
  timeline: (context) => {
    if ((context.component as { dataSource?: unknown } | undefined)?.dataSource !== undefined) {
      return recordBoundTimelineComponent(context)
    }
    const { elementPropsWithSpacing, content, renderedChildren, interactions } = context
    const authorClassName = elementPropsWithSpacing['className'] as string | undefined
    const mergedClassName = mergePrestyle(computeTimelineContainerClasses(), authorClassName)
    // `renderHTMLElement` renders `{content || children}`, so this Fragment
    // becomes the sole entry of a one-element LIST and React requires a key on
    // it. The `<>` shorthand cannot carry one, hence the explicit `Fragment`.
    // Keeping the body as a single wrapped entry (rather than flattening it
    // into the array) preserves `children.length`, which `renderHTMLElement`
    // feeds to `buildAccessibilityRole` — flattening would change the role.
    const children = (
      <Fragment key="timeline-body">
        <div
          aria-hidden="true"
          className={computeTimelineRailClasses()}
        />
        {content}
        {renderedChildren}
      </Fragment>
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

  // `sidebar` — a layout box, plus (when declared) the `groups` navigation
  // landmark. The groups render BEFORE any authored children so a sidebar that
  // carries both reads top-down as navigation first, then whatever the author
  // put underneath.
  sidebar: ({
    elementProps,
    content,
    renderedChildren,
    interactions,
    component,
    currentLang,
    languages,
  }) => {
    const { groups, trackNavigation, rail } = (component ?? {}) as {
      groups?: readonly SidebarGroup[]
      trackNavigation?: boolean
      rail?: { below?: SidebarRailBreakpoint }
    }
    const below = rail?.below
    const children =
      groups !== undefined && groups.length > 0
        ? [
            renderSidebarGroups(
              groups,
              { currentLang, languages },
              trackNavigation === true,
              below
            ),
            ...renderedChildren,
          ]
        : renderedChildren
    // The rail's WIDTH is the only thing that belongs on the box — everything
    // else it does is a rule on the navigation root inside. The props object is
    // left untouched when no rail is declared, so a sidebar that declares none
    // renders the attributes it has always rendered, byte for byte.
    const railBox = computeSidebarRailBoxClasses(below)
    return Renderers.renderHTMLElement({
      type: 'div',
      props:
        railBox === ''
          ? elementProps
          : {
              ...elementProps,
              className: resolveClasses(
                railBox,
                undefined,
                elementProps['className'] as string | undefined
              ),
            },
      content: content,
      children: children,
      interactions: interactions,
    })
  },

  toast: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderHTMLElement({
      type: 'div',
      props: elementProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    }),

  // Spinner — the box, the mark that turns in it, and the announcement.
  //
  // It was a bare passthrough `<div>` until review row 49 (2026-09-16): _"Il
  // n'y a pas de spinner, on ne voit rien."_ The element had a box wherever an
  // author had sized it, so it was VISIBLE and three assertions said so while
  // the reader saw nothing — which is why the criteria behind this one are
  // written on ink, motion, box and role rather than on visibility.
  //
  // `role` is applied AFTER the author's props, like `divider`'s `separator`:
  // a spinner announces that something is happening whether or not the author
  // remembered to say so. `label` becomes the accessible NAME and leaves the
  // spread, `label` not being an attribute a `<div>` has — the same key
  // `progress-component.tsx` already reads for the same purpose, which is why
  // naming a spinner needs no schema change.
  spinner: ({ elementProps, content, renderedChildren, interactions }) => {
    const { label, className: authorClassName, ...rest } = elementProps
    const accessibleName = typeof label === 'string' && label.length > 0 ? label : undefined
    return Renderers.renderHTMLElement({
      type: 'div',
      props: {
        ...rest,
        className: mergePrestyle(computeSpinnerClasses(), authorClassName as string | undefined),
        role: 'status',
        ...(accessibleName === undefined ? {} : { 'aria-label': accessibleName }),
      },
      content: content,
      children: [Renderers.renderSpinnerMark(computeSpinnerGlyphClasses()), ...renderedChildren],
      interactions: interactions,
    })
  },

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
          {...omitInternalMarkers(elementProps)}
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
        {...omitInternalMarkers(elementProps)}
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
    const userClassName = elementProps['className'] as string | undefined
    return (
      <div
        aria-hidden="true"
        data-testid={elementProps['data-testid'] as string | undefined}
        className={mergePrestyle(sizeClass, userClassName)}
      />
    )
  },
}
