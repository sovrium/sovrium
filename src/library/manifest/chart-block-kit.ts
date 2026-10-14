/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the CHART blocks share: shadcn/ui's chart gallery puts every chart in
 * the same card — a header holding the title and one line under it, the chart
 * as the card's content — so the card is drawn once, here, in shadcn's parts
 * (`card-header`, `card-title`, `card-description`, `card-content`).
 *
 * ─── THE CHART IS THE ENGINE'S, THE CARD IS THE BLOCK'S ────────────────────
 *
 * Each block names a `chart` and its options; the axes, the tooltip, the
 * legend and the palette are drawn by the chart component itself. So a block
 * never sizes or colours its chart: a chart fills the width of the card's
 * content and takes its colours from the theme's chart palette.
 */

import type { BlockNode } from './block-kit'

/** The relative-date filter value the six-month blocks read from. */
export const SIX_MONTHS_AGO = '$today-26w'

/** The records of `table` whose `dateField` falls in the last six months. */
export const lastSixMonths = (table: string, dateField: string): BlockNode => ({
  table,
  filter: [{ field: dateField, operator: 'gte', value: SIX_MONTHS_AGO }],
})

/** The card title and the line under it, in shadcn's header parts. */
export const chartCardHeader = (
  title: string,
  description: string,
  className = 'grid auto-rows-min items-start gap-2 px-6'
): BlockNode => ({
  type: 'container',
  props: { 'data-slot': 'card-header', className },
  children: [
    {
      type: 'text',
      element: 'h2',
      props: {
        'data-slot': 'card-title',
        className: 'text-lg leading-none font-semibold text-foreground',
      },
      content: title,
    },
    {
      type: 'text',
      element: 'p',
      props: { 'data-slot': 'card-description', className: 'text-md text-muted-foreground' },
      content: description,
    },
  ],
})

/** The card's content: the chart, inset like the header. */
export const chartCardContent = (chart: BlockNode, className = 'px-6'): BlockNode => ({
  type: 'container',
  props: { 'data-slot': 'card-content', className },
  children: [chart],
})

/** shadcn's card holding a header and the chart; `extra` adds to the card's own classes. */
export const chartCard = (header: BlockNode, content: BlockNode, extra = 'py-6'): BlockNode => ({
  type: 'card',
  props: { className: `flex flex-col gap-6 p-0 ${extra}`.trim() },
  children: [header, content],
})

/** The note every six-month chart block carries on the records it reads. */
export const SIX_MONTHS_NOTE =
  'The chart reads the records whose date falls in the last 26 weeks, counted from the day the page is read. Change the `filter` value `$today-26w` in the installed block to read a longer or shorter span.'

/** The note every chart block carries on colour. */
export const CHART_THEME_NOTE =
  'The chart takes its colours from the chart palette (`chart-1` to `chart-5`) and the card from the colour tokens, so the block follows your app’s `design` without edits.'
