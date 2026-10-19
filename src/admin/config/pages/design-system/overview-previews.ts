/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// DESIGN SYSTEM · Overview — the small drawing beside each Pages row, drawn
// from the app's own design. Split from `overview.ts`, which lays out the rows.

import {
  DESIGN_GUIDANCE_ENDPOINT,
  DESIGN_TOKENS_ENDPOINT,
  DESIGN_USAGE_ENDPOINT,
} from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ─── THE PREVIEW BESIDE EACH ROW ───────────────────────────────────────────
//
// A row naming a page and describing it in a line still leaves a reader
// guessing what is on the other side of the chevron. A small drawing lifted
// from that page answers it in the width the row already has — the colour
// ramp for Foundations, the console topbar for Components, the mark for Brand, one sentence in the app's own
// voice for Voice.
//
// Each is composed from real kit types, drawn at rest. None of them is a
// screenshot and none is an iframe: the console renders its own components, so
// a drawing here IS the thing it previews, and it moves when the theme does.

/**
 * The frame every preview sits in, so the five read as one column.
 *
 * `min-w-0` and `overflow-hidden`: a flex item is floored at its content's
 * width, so a palette wider than the row would otherwise push the frame past
 * the row's end and squeeze the description beside it to one word a line. The
 * frame takes the width the row leaves, and a strip too long for it is cut.
 *
 * It carries the console's body step because font-size INHERITS: a drawing
 * holding a component that rules no typography class would otherwise inherit
 * the document root and draw bigger than the row naming it.
 */
const previewSlot = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-muted hidden min-h-[4.5rem] min-w-0 flex-1 items-center overflow-hidden justify-center gap-3 rounded-md border px-4 text-base md:flex',
    },
    children: [...children],
  }) as PageComponent

/**
 * One colour of the app's palette, painted with the value the token read
 * publishes. `declared` picks which half of the palette a list draws.
 */
const previewSwatches = (declared: boolean): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    dataSource: {
      system: {
        endpoint: DESIGN_TOKENS_ENDPOINT,
        query: { group: 'color' },
        rowsKey: 'items',
        idKey: 'path',
      },
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border size-6 shrink-0 rounded-sm border',
          'data-design-preview-swatch': '$record.leaf',
          title: '$record.leaf',
          style: { backgroundColor: '$record.value' },
        },
        visibility: { record: { field: 'overridden', eq: declared } },
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * Foundations: the app's own palette, the colours it declares first, then the
 * ones it inherits, each filled with its value. As many as fit the row; the
 * rest are on the page the row links to.
 */
const foundationsPreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'flex w-full items-center gap-1.5 overflow-hidden',
        'data-design-overview-preview': 'foundations',
      },
      children: [previewSwatches(true), previewSwatches(false)],
    } as PageComponent,
  ])

/** Components: the names of the templates the app declares, in its own order. */
const componentsPreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'flex w-full items-center gap-1.5 overflow-hidden',
        'data-design-overview-preview': 'components',
      },
      dataSource: {
        system: {
          endpoint: DESIGN_USAGE_ENDPOINT,
          query: { subject: 'component' },
          rowsKey: 'items',
          idKey: 'name',
        },
      },
      children: [
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'border-border bg-background text-foreground shrink-0 rounded-sm border px-2 py-1 font-mono text-[11px]',
          },
          content: '$record.name',
        } as PageComponent,
      ],
    } as PageComponent,
  ])

/**
 * Brand: the app's mark beside its name, at the size a header uses.
 *
 * The mark is the tile the sidebar head and the login card draw — its
 * `design.logo`, else a monogram of its display name, filled in by the engine
 * (`data-app-mark`) — so the preview shows the operator's identity, never the
 * engine's.
 */
const brandPreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex items-center gap-2.5' },
      children: [
        {
          type: 'container',
          props: {
            className:
              'bg-primary text-primary-foreground flex size-6 items-center justify-center overflow-hidden rounded-md text-xs font-semibold data-[app-mark=logo]:bg-transparent',
            'data-app-mark': 'tile',
          },
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-foreground text-md font-semibold tracking-tight' },
          content: '$app.label',
        },
      ],
    } as PageComponent,
  ])

/**
 * Voice: one sentence of the app's own voice — its first preferred line, else
 * its first personality trait (`voicePreview` on the guidance read) — or, when
 * it declares neither, that it does not.
 */
const voicePreview = (): PageComponent =>
  previewSlot([
    {
      type: 'container',
      element: 'div',
      props: { className: 'contents' },
      dataSource: { system: { endpoint: DESIGN_GUIDANCE_ENDPOINT, rowsKey: 'voicePreview' } },
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'text-center',
            'data-design-overview-preview': 'voice',
            'data-design-preview-state': '$record.state',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground-subtle text-md italic' },
              visibility: { record: { field: 'state', eq: 'declared' } },
              content: '$record.line',
            } as PageComponent,
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-muted-foreground text-sm' },
              visibility: { record: { field: 'state', eq: 'undeclared' } },
              content: '$t:admin.ds.overview.voiceUndeclared',
            } as PageComponent,
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

export const PREVIEWS: Readonly<Record<string, () => PageComponent>> = {
  foundations: foundationsPreview,
  components: componentsPreview,
  brand: brandPreview,
  voice: voicePreview,
}
