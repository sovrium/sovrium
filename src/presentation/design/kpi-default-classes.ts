/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui dashboard-01 section cards (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `kpi` on shadcn/ui's anatomy: one of the section cards of the
 * dashboard-01 block.
 *
 * The island HOST is the card (`data-slot="card"`, `@container/card`); its
 * header holds the label as the card description and the figure as the card
 * title, with the trend as an outline badge in the card action; the content
 * holds the sparkline and the footer a ratio's counts. Every part is the
 * card recipe's (`card-default-classes.ts`), with the section cards'
 * overrides on the title and the footer.
 *
 * The card is drawn twice — by the SSR host in
 * `render/registry/island-kpi-component.tsx` and by the hydrated island in
 * `islands/kpi/kpi-card.tsx` — so every class is here, and the two cannot
 * drift apart on hydration.
 */

import { CARD_PART_CLASSES, CARD_SURFACE } from '@/presentation/design/card-default-classes'
import { responsiveClasses, type ResponsiveValues } from '@/presentation/design/responsive-classes'

/**
 * The card surface without its clip. base-nova's card clips its content so a
 * leading or trailing image takes the card's corners; a KPI holds no image, and
 * its corner parts (the footer) round themselves. The clip is what cut the
 * first letter of every label: a host that nests the KPI in its own card zeroes
 * `--card-spacing`, which puts the label's first glyph on the clip edge, and a
 * glyph whose ink starts left of its advance (`F`, `T`, `I`) lost its stem.
 */
const KPI_CARD_SURFACE = CARD_SURFACE.replace(' overflow-hidden ', ' ')

/**
 * Compute the className for the KPI host — the card itself.
 *
 * `@container/card` lets the figure grow on a wide card. An error or
 * missing-binding state is a semantic status surface of its own
 * (`role="alert"`), so the card steps out of the box around it rather than
 * framing the alert as a metric that happens to be broken.
 */
export const computeKpiCardClasses = (): string =>
  `${KPI_CARD_SURFACE} @container/card has-[>[role=alert]]:contents`

/**
 * What the island mounts inside the host: `display: contents`, so the header,
 * content and footer it draws are the card's own flex children, spaced by the
 * card's `--card-spacing` gap.
 */
export const KPI_STACK_CLASSES = 'contents'

/** The card header: the label, the figure and the trend. */
export const KPI_HEADER_CLASSES = CARD_PART_CLASSES.header

/** The label — the card description, an optional icon before it. */
export const computeKpiLabelClasses = (): string =>
  `${CARD_PART_CLASSES.description} flex items-center gap-1.5`

/**
 * The icon box beside the label. Its 16px geometry is set on the `<svg>`
 * itself (lucide's renderer writes the attributes), so this owns only the
 * flex behaviour: `shrink-0` keeps the glyph square when a long label pushes.
 */
export const computeKpiIconClasses = (): string => 'inline-flex shrink-0'

/**
 * The figure's type size when no `size` is declared: the section cards'
 * `text-2xl`, rising to `text-3xl` on a card at least 250px wide.
 */
const KPI_VALUE_DEFAULT_SIZE = 'text-2xl @[250px]/card:text-3xl'

/**
 * Compute the className for the figure — the card title (`data-role="kpi-value"`).
 *
 * The section cards' semibold tabular figures, in the sans face: tabular
 * digits align a column of figures and keep a live value from jittering.
 * `truncate` holds a long currency aggregate to one line. No colour: the
 * island appends the tone or a matching threshold's ink, else the card
 * foreground.
 *
 * @param sized - true when the author declared a `size`, whose classes then
 *   set the type size alone
 */
export const computeKpiValueClasses = ({ sized = false }: { sized?: boolean } = {}): string =>
  `truncate font-semibold tabular-nums${sized ? '' : ` ${KPI_VALUE_DEFAULT_SIZE}`}`

/** The card action that holds the trend badge. */
export const KPI_ACTION_CLASSES = CARD_PART_CLASSES.action

/** The card content that holds the sparkline. */
export const KPI_CONTENT_CLASSES = CARD_PART_CLASSES.content

/** The sparkline's `<svg>`: 28px tall, matching its own viewBox. */
export const KPI_SPARKLINE_SVG_CLASSES = 'block h-7 w-full'

/** The sparkline's series colour: the second chart colour. */
export const KPI_SPARKLINE_STROKE = 'var(--chart-2)'

/** The sparkline's stroke weight. */
export const KPI_SPARKLINE_STROKE_WIDTH = 1.5

/**
 * The card footer holding a ratio's counts — the section cards' footer:
 * a column of lines, in the muted foreground.
 */
export const KPI_FOOTER_CLASSES = `${CARD_PART_CLASSES.footer} flex-col items-start gap-1.5 text-sm text-muted-foreground tabular-nums`

/** A skeleton — base-nova's `Skeleton`. */
export const KPI_SKELETON_CLASSES = 'animate-pulse rounded-md bg-muted'

// ──────────────────────────────────────────────────────────────────────────────
// VALUE SIZE — the KPI's `size`, per breakpoint
// ──────────────────────────────────────────────────────────────────────────────

/** `md` is the section cards' wide-card size; `sm` suits a row of figures on a phone. */
const KPI_VALUE_SIZES = {
  sm: {
    mobile: 'text-xl',
    sm: 'sm:text-xl',
    md: 'md:text-xl',
    lg: 'lg:text-xl',
    xl: 'xl:text-xl',
    '2xl': '2xl:text-xl',
  },
  md: {
    mobile: 'text-3xl',
    sm: 'sm:text-3xl',
    md: 'md:text-3xl',
    lg: 'lg:text-3xl',
    xl: 'xl:text-3xl',
    '2xl': '2xl:text-3xl',
  },
  lg: {
    mobile: 'text-4xl',
    sm: 'sm:text-4xl',
    md: 'md:text-4xl',
    lg: 'lg:text-4xl',
    xl: 'xl:text-4xl',
    '2xl': '2xl:text-4xl',
  },
} as const

/**
 * The size classes of a KPI value, from its per-breakpoint `size`.
 *
 * @param size - The declared `size` struct, if any.
 */
export const computeKpiValueSizeClasses = (
  size: ResponsiveValues<keyof typeof KPI_VALUE_SIZES> | undefined
): string => responsiveClasses(size, KPI_VALUE_SIZES)
