/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CARD_SLOT_ATTRIBUTES, computeCardClasses } from '../../design/card-default-classes'
import {
  computeSpinnerClasses,
  computeSpinnerGlyphClasses,
} from '../../design/feedback-default-classes'
import * as Renderers from '../elements'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { bubbleComponents } from './bubble-component'
import { renderCardAnatomy } from './card-anatomy'
import { DESIGN_SCOPE_ATTRIBUTE } from './design-components'
import { mergePrestyle } from './interactive-prestyle-builders'
import { recordBoundTimelineComponent } from './island-data-components'
import { itemComponent } from './item-component'
import { separatorComponent } from './separator-component'
import { renderSidebarComponent } from './sidebar-component'
import { renderTimelineRail } from './timeline-rail-component'
import { toastComponent } from './toast-component'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

/**
 * Structural HTML components (section, header, footer, main, etc.)
 *
 * These components render semantic HTML elements for page structure.
 */
/**
 * The marker a repeating container carries into the browser (the record-drawer children-slot design, CAP-6).
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
 * The name a repeat gave its element (`repeat.as`, the run-as-a-page design), carried beside the
 * field so the island knows which namespace a copy's `$<as>.` tokens read.
 * Absent when the repeat is unnamed, so a CAP-6 container renders exactly as it
 * did before names existed. Spelled on both sides for the reason above.
 */
const REPEAT_AS_ATTRIBUTE = 'data-repeat-as'

/**
 * The markers of a container that asked to iterate, or `undefined` for the 30-odd
 * containers on a page that asked for nothing.
 *
 * Emitting the marker only where `repeat` was authored is what keeps the key
 * ADDITIVE: a container without it renders byte-for-byte what it did before
 * this attribute existed, which is the control `-REPEAT-003` pins.
 *
 * WHERE a `repeat` may legally stand is not decided here. `repeatPlacementViolations`
 * refuses one outside a record-bound drawer's slot or a page bound to one record
 * at DECODE, and the page binding pass expands (and drops) the page's own before
 * render, so the only surviving markers are inside a slot the island owns.
 */
function containerRepeatMarkers(component: unknown): Record<string, string> | undefined {
  const repeat = (component as Record<string, unknown> | undefined)?.['repeat']
  if (typeof repeat !== 'object' || repeat === null) return undefined
  const { record: field, as } = repeat as Record<string, unknown>
  if (typeof field !== 'string' || field.length === 0) return undefined
  return typeof as === 'string' && as.length > 0
    ? { [REPEAT_ATTRIBUTE]: field, [REPEAT_AS_ATTRIBUTE]: as }
    : { [REPEAT_ATTRIBUTE]: field }
}

export const structuralComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  ...bubbleComponents,
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
    const repeatMarkers = containerRepeatMarkers(component)
    return Renderers.renderHTMLElement({
      type: element,
      props:
        repeatMarkers === undefined
          ? elementPropsWithSpacing
          : { ...elementPropsWithSpacing, ...repeatMarkers },
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
  // TWO VARIANTS BRANCH HERE: `scoped`, the design boundary, and `specimen`,
  // the stage a drawn component sits on. The dispatch is in the renderer rather
  // than the registry because the registry is keyed by `type`. (A chat turn's
  // surface is its own type, `bubble`.)
  card: (context) => {
    const { elementPropsWithSpacing, content, renderedChildren, component } = context
    const variant = (component as { variant?: unknown } | undefined)?.variant
    const authorClassName = elementPropsWithSpacing['className'] as string | undefined

    // `scoped` — the boundary the operator's design paints inside. The children
    // go INSIDE it and not beside it: a scope emitting the attribute next to
    // its children would satisfy "the attribute is present" and scope nothing.
    //
    // BARE, unlike its two sibling variants: `replaceDefaults` drops the card
    // recipe, so this paints no background, border, radius or padding. A scope
    // is a BOUNDARY, not a surface — and the recipe is not merely superfluous
    // here, it is actively wrong. Its three surface reads (`--card`,
    // `--border`, `--radius-md`) are re-declared INSIDE the scope by the
    // documented design, so a scoped card wearing the recipe frames whatever it
    // documents in that design's own colours: a raised, bordered box nobody
    // authored and no config can switch off.
    //
    // `replaceDefaults` rather than dropping `className`, because "bare" means
    // "no recipe", not "no classes". The author channel survives — and so does
    // the inert `card` marker `style-processor.ts` writes from
    // `COMPONENT_TYPE_CLASS_MAP`, which arrives here already merged into
    // `authorClassName`. No `@layer components` rule answers it, so it paints
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
          {...CARD_SLOT_ATTRIBUTES}
          className={mergePrestyle(computeCardClasses(), authorClassName)}
        >
          <div data-specimen-stage="">{content || renderedChildren}</div>
        </div>
      )
    }

    return renderCardAnatomy(context)
  },

  // Timeline. TWO SHAPES, ONE TYPE: with a `dataSource` it is the record-bound
  // Gantt and mounts its island; without, it draws its authored children as an
  // ordered list of events, one marker per child, and mounts nothing. The
  // binding — not a mode flag — decides, and declaring both is REFUSED at
  // decode (`component-xor-rules.ts`): the author's children would vanish unseen.
  timeline: (context) => {
    if ((context.component as { dataSource?: unknown } | undefined)?.dataSource !== undefined) {
      return recordBoundTimelineComponent(context)
    }
    return renderTimelineRail(context)
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
  // landmark, a rail and a drawer. Its own module: `sidebar-component.tsx`.
  sidebar: renderSidebarComponent,

  // `toast` placed in the tree — its variant, action and duration (its own module).
  toast: toastComponent,

  // Spinner — the box, the mark that turns in it, and the announcement.
  //
  // It was a bare passthrough `<div>` until review row 49: _"Il
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
        'data-slot': 'spinner',
        role: 'status',
        ...(accessibleName === undefined ? {} : { 'aria-label': accessibleName }),
      },
      content: content,
      children: [Renderers.renderSpinnerMark(computeSpinnerGlyphClasses()), ...renderedChildren],
      interactions: interactions,
    })
  },

  // `item` — one row of a list, on shadcn/ui's Item anatomy (its own module).
  item: itemComponent,

  // `separator` — shadcn/ui's Separator, horizontal, vertical or labelled (its own module).
  separator: separatorComponent,

  // Spacer — renders an empty `data-slot="spacer"` div with a configurable
  // height and no paint. `size` (sm/md/lg/xl) maps to Tailwind h-* utilities;
  // defaults to `md`.
  spacer: ({ elementProps }) => {
    const size = elementProps['size'] as string | undefined
    const sizeClass =
      size === 'sm' ? 'h-2' : size === 'lg' ? 'h-12' : size === 'xl' ? 'h-20' : 'h-6'
    const userClassName = elementProps['className'] as string | undefined
    return (
      <div
        aria-hidden="true"
        data-slot="spacer"
        data-testid={elementProps['data-testid'] as string | undefined}
        className={mergePrestyle(sizeClass, userClassName)}
      />
    )
  },
}
