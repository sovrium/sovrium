/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared recipes every block entry composes from — section rhythm, the
 * heading ladder, link-shaped buttons, image placeholders.
 *
 * WHY A KIT: seventy blocks written by hand would drift from each other in
 * spacing and type within a week. Each helper returns a plain component node
 * built only from existing component types and theme-token utilities
 * (`text-foreground`, `bg-background-raised`, `border-border`, `bg-primary` …),
 * so a block follows whatever `theme` the operator declares and the fragment
 * it writes is the exact config an operator would type by hand. Nothing here
 * runs at install time beyond building that data.
 *
 * Buttons that GO somewhere are `link` components drawn as buttons: a `button`
 * has no DOM `href`, and a call to action has to be a real anchor.
 */

import type { LibraryFragmentByKey } from './define'

/** One component node inside a block fragment. */
export type BlockNode = Readonly<Record<string, unknown>>

/**
 * Name the root node of a block. The one cast in the kit: a template's
 * `children` are typed `unknown` by the schema itself (they recurse through a
 * suspended union), so the tree cannot be checked by `tsc` beyond its root —
 * the Library Entry Validity gate decodes every block inside an app instead.
 */
export const asComponent = (name: string, root: BlockNode): LibraryFragmentByKey['components'] =>
  ({ name, ...root }) as unknown as LibraryFragmentByKey['components']

/** Read a string parameter, falling back to its declared default upstream. */
export const str = (params: Readonly<Record<string, unknown>>, key: string): string =>
  String(params[key] ?? '')

// ─── Layout ────────────────────────────────────────────────────────────────

/** The outer band of a marketing section: vertical rhythm plus the side gutter. */
export const section = (
  children: readonly BlockNode[],
  options: { readonly element?: string; readonly className?: string } = {}
): BlockNode => ({
  type: 'container',
  element: options.element ?? 'section',
  props: {
    className: `px-5 py-14 sm:px-8 sm:py-20 lg:px-16 lg:py-24 ${options.className ?? ''}`.trim(),
  },
  children,
})

/** The centred measure every section's content sits in. */
export const wrap = (children: readonly BlockNode[], width = 'max-w-6xl'): BlockNode => ({
  type: 'container',
  props: { className: `mx-auto w-full ${width}` },
  children,
})

export const flex = (children: readonly BlockNode[], className: string): BlockNode => ({
  type: 'flex',
  props: { className: `flex ${className}` },
  children,
})

export const stack = (children: readonly BlockNode[], className = 'gap-3'): BlockNode =>
  flex(children, `flex-col ${className}`)

/** A grid whose columns collapse to one below `sm`, then open per breakpoint. */
export const grid = (children: readonly BlockNode[], className: string): BlockNode => ({
  type: 'grid',
  props: { className: `grid grid-cols-1 ${className}` },
  children,
})

export const card = (children: readonly BlockNode[], className = 'p-6'): BlockNode => ({
  type: 'card',
  props: { className },
  children,
})

export const divider = (): BlockNode => ({ type: 'divider' })

// ─── Type ──────────────────────────────────────────────────────────────────

const text = (element: string, content: string, className: string): BlockNode => ({
  type: 'text',
  element,
  props: { className },
  content,
})

/** The page-level headline. One per page. */
export const h1 = (content: string, extra = ''): BlockNode =>
  text(
    'h1',
    content,
    `text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05] ${extra}`.trim()
  )

export const h2 = (content: string, extra = ''): BlockNode =>
  text(
    'h2',
    content,
    `text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl sm:leading-[1.1] ${extra}`.trim()
  )

export const h3 = (content: string, extra = ''): BlockNode =>
  text('h3', content, `text-xl font-semibold text-foreground ${extra}`.trim())

export const h4 = (content: string, extra = ''): BlockNode =>
  text('h4', content, `text-md font-semibold text-foreground ${extra}`.trim())

/** The sentence under a headline. */
export const lead = (content: string, extra = ''): BlockNode =>
  text('p', content, `text-lg text-pretty text-foreground-muted sm:text-xl ${extra}`.trim())

export const body = (content: string, extra = ''): BlockNode =>
  text('p', content, `text-md leading-relaxed text-pretty text-foreground-muted ${extra}`.trim())

export const small = (content: string, extra = ''): BlockNode =>
  text('p', content, `text-sm text-foreground-subtle ${extra}`.trim())

/** A short monospace label above a headline, marked with the app's primary colour. */
export const eyebrow = (content: string): BlockNode =>
  flex(
    [
      { type: 'container', props: { className: 'size-1.5 rounded-sm bg-primary' } },
      text('span', content, 'font-mono text-sm text-foreground-subtle'),
    ],
    'items-center gap-2'
  )

// ─── Actions ───────────────────────────────────────────────────────────────

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] no-underline hover:no-underline focus-visible:no-underline'

const BUTTON_TONE = {
  primary: 'border-primary bg-primary text-primary-fg hover:bg-primary-hover hover:text-primary-fg',
  secondary:
    'border-border-strong bg-background-raised text-foreground hover:bg-background-subtle hover:text-foreground',
  ghost: 'border-transparent text-foreground hover:bg-background-subtle hover:text-foreground',
} as const

const BUTTON_SIZE = { md: 'h-10 px-4 text-md', lg: 'h-12 px-5 text-md' } as const

export type ButtonTone = keyof typeof BUTTON_TONE

/** A link drawn as a button. */
export const linkButton = (
  label: string,
  href: string,
  tone: ButtonTone = 'primary',
  size: keyof typeof BUTTON_SIZE = 'md'
): BlockNode => ({
  type: 'link',
  props: { href, className: `${BUTTON_BASE} ${BUTTON_TONE[tone]} ${BUTTON_SIZE[size]}` },
  content: label,
})

/** A quiet inline link with a trailing arrow. */
export const arrowLink = (label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    className:
      'inline-flex items-center gap-1.5 text-md font-medium text-foreground underline-offset-4 hover:underline',
  },
  children: [
    { type: 'text', element: 'span', content: label },
    { type: 'icon', props: { name: 'arrow-right', size: 16 } },
  ],
})

/** A plain navigation link. */
export const navLink = (label: string, href: string): BlockNode => ({
  type: 'link',
  props: { href, className: 'text-md text-foreground-muted hover:text-foreground' },
  content: label,
})

/** Two calls to action side by side, stacked full-width on a phone. */
export const actions = (items: readonly BlockNode[], extra = ''): BlockNode =>
  flex(items, `flex-col gap-3 sm:flex-row sm:items-center ${extra}`.trim())

// ─── Media ─────────────────────────────────────────────────────────────────

/**
 * An image when a source is given, else a hatched placeholder of the same
 * ratio — so a freshly installed block shows where its picture goes instead of
 * a broken image.
 */
export interface MediaOptions {
  /** Image URL; empty draws the placeholder. */
  readonly src: string
  readonly alt: string
  /** An aspect-ratio utility, e.g. `aspect-[4/3]`. */
  readonly ratio: string
  /** The placeholder's caption, e.g. `image · 4:3`. */
  readonly label: string
  readonly className?: string
}

export const media = ({ src, alt, ratio, label, className = '' }: MediaOptions): BlockNode =>
  src.trim() !== ''
    ? {
        type: 'image',
        props: {
          src,
          alt,
          loading: 'lazy',
          className:
            `w-full rounded-lg border border-border object-cover ${ratio} ${className}`.trim(),
        },
      }
    : {
        type: 'container',
        props: {
          className:
            `flex w-full items-center justify-center rounded-lg border border-border bg-background-inset ${ratio} ${className}`.trim(),
          role: 'img',
          'aria-label': alt,
        },
        children: [text('span', label, 'font-mono text-sm text-foreground-subtle')],
      }

export const icon = (name: string, className = 'text-foreground', size = 22): BlockNode => ({
  type: 'icon',
  props: { name, size, className },
})

/** An icon in a small raised square — the feature-list marker. */
export const iconTile = (name: string): BlockNode => ({
  type: 'container',
  props: {
    className:
      'flex size-10 flex-none items-center justify-center rounded-md border border-border bg-background-raised text-foreground',
  },
  children: [icon(name, '', 20)],
})

/** A logo placeholder: a mark and a wordmark. */
export const logo = (name: string, href = '/'): BlockNode => ({
  type: 'link',
  props: {
    href,
    className: 'inline-flex items-center gap-2.5 text-lg font-semibold text-foreground',
  },
  children: [
    {
      type: 'container',
      props: { className: 'size-5 rounded bg-foreground', 'aria-hidden': 'true' },
    },
    { type: 'text', element: 'span', content: name },
  ],
})

// ─── Marketing section parts (appended with the marketing blocks) ─────────

/** Read a parameter as a string and say whether the operator emptied it. */
export const param =
  (params: Readonly<Record<string, unknown>>) =>
  (key: string): string =>
    str(params, key)

/** Keep a node only when its text is non-empty — how a block drops an optional element. */
export const when = (value: string, node: BlockNode): readonly BlockNode[] =>
  value.trim() === '' ? [] : [node]

/**
 * The heading group that opens most sections: optional eyebrow, an h2 and an
 * optional lead, left-aligned or centred.
 */
export const sectionHead = (
  head: { readonly eyebrow?: string; readonly title: string; readonly lead?: string },
  align: 'start' | 'center' = 'start',
  extra = ''
): BlockNode =>
  stack(
    [
      ...when(head.eyebrow ?? '', eyebrow(head.eyebrow ?? '')),
      h2(head.title),
      ...when(head.lead ?? '', lead(head.lead ?? '')),
    ],
    align === 'center'
      ? `mx-auto max-w-2xl items-center gap-4 text-center ${extra}`.trim()
      : `max-w-2xl gap-4 ${extra}`.trim()
  )

/** A bulleted list with a check icon per line. */
export const checkList = (items: readonly string[]): BlockNode =>
  stack(
    items.map((item) =>
      flex(
        [
          icon('check', 'mt-0.5 flex-none text-foreground', 18),
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-md text-foreground-muted' },
            content: item,
          },
        ],
        'items-start gap-2'
      )
    ),
    'gap-2'
  )

/** An icon, a short title and one or two lines — the feature-grid cell. */
export const featureItem = (iconName: string, title: string, description: string): BlockNode =>
  stack(
    [icon(iconName, 'text-foreground', 22), h4(title, 'mt-2 text-lg'), body(description)],
    'gap-2'
  )

/** A person drawn as initials, a name and a role. */
export const person = (
  name: string,
  role: string,
  size: 'md' | 'lg' = 'md',
  initials = 'AB'
): BlockNode =>
  flex(
    [
      { type: 'avatar', label: name, initials, size },
      stack(
        [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-md font-semibold text-foreground' },
            content: name,
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-sm text-foreground-subtle' },
            content: role,
          },
        ],
        'gap-0.5 text-left'
      ),
    ],
    'items-center gap-3'
  )

/** A figure drawn in the monospace face — a stat or a price. */
export const figure = (value: string, extra = ''): BlockNode => ({
  type: 'text',
  element: 'span',
  props: {
    className: `font-mono text-5xl font-medium tracking-tight text-foreground ${extra}`.trim(),
  },
  content: value,
})

/** A string parameter with its default — the shape every block's `params` repeats. */
export const stringParam = (
  name: string,
  description: string,
  defaultValue: string
): {
  readonly name: string
  readonly description: string
  readonly type: 'string'
  readonly default: string
} => ({
  name,
  description,
  type: 'string',
  default: defaultValue,
})

/** The note every block carries on how to place it. */
export const PLACE_NOTE =
  'The block is a reusable component. Place it on a page with `component: <name>` under the page `components` list.'

/** The note every block carries on colour. */
export const THEME_NOTE =
  'Colours come from the theme tokens, so the block follows your `theme` without edits.'

// ─── Data-bound parts (appended with the data-bound blocks) ───────────────

/** The note every data-bound block carries on the table it reads. */
export const DATA_NOTE =
  'The block reads a table you already have: `library add` refuses until your config declares it, and lists the table and fields it expects. Point it at your own names with `--set` on the table and field parameters.'

/** The heading group above an application panel: a title and an optional line. */
export const panelHead = (title: string, description = ''): BlockNode =>
  stack(
    [
      h3(title, 'text-lg'),
      ...when(description, {
        type: 'text',
        element: 'p',
        props: { className: 'text-md text-foreground-muted' },
        content: description,
      }),
    ],
    'gap-1'
  )

/** The padding an application-UI block sits in — tighter than a marketing section. */
export const panel = (children: readonly BlockNode[], extra = ''): BlockNode => ({
  type: 'container',
  element: 'section',
  props: { className: `px-4 py-6 sm:px-8 sm:py-8 ${extra}`.trim() },
  children,
})

// ─── Pricing (shared by the two pricing-card blocks) ──────────────────────

/** Placeholder plans: replace every bracket before publishing. */
export interface PricingTier {
  readonly name: string
  readonly audience: string
  readonly items: readonly string[]
  readonly highlighted: boolean
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    name: '[Plan A]',
    audience: 'For [who] starting out.',
    items: ['[Included item]', '[Included item]', '[Limit]'],
    highlighted: false,
  },
  {
    name: '[Plan B]',
    audience: 'For [who] who [need].',
    items: ['Everything in [Plan A]', '[Included item]', '[Included item]', '[Limit]'],
    highlighted: true,
  },
  {
    name: '[Plan C]',
    audience: 'For [who] at scale.',
    items: ['Everything in [Plan B]', '[Included item]', '[Named contact]'],
    highlighted: false,
  },
]

/** One pricing card. Shared by the three-tier and the period-switching blocks. */
export const pricingCard = ({
  tier,
  period,
  price,
  href,
}: {
  readonly tier: PricingTier
  readonly period: string
  readonly price: string
  readonly href: string
}): BlockNode => ({
  type: 'card',
  props: {
    className:
      `flex flex-col gap-4 p-6 sm:p-8 ${tier.highlighted ? 'border-foreground ring-1 ring-foreground' : ''}`.trim(),
  },
  children: [
    flex(
      [
        h3(tier.name),
        ...when(tier.highlighted ? 'x' : '', { type: 'badge', content: '[Most chosen]' }),
      ],
      'items-center justify-between gap-2'
    ),
    body(tier.audience, 'text-sm sm:text-md'),
    flex([figure(price, 'text-4xl'), small(`/ ${period}`)], 'items-baseline gap-2'),
    linkButton(
      `[Choose ${tier.name.slice(1, -1)}]`,
      href,
      tier.highlighted ? 'primary' : 'secondary'
    ),
    divider(),
    checkList(tier.items),
  ],
})

// ─── Forms that post to the operator's own endpoint ───────────────────────

/** One field of an endpoint-bound form. */
export interface EndpointField {
  readonly field: string
  readonly control: 'text' | 'email' | 'textarea' | 'tel' | 'url'
  readonly label: string
  readonly placeholder?: string
}

/**
 * A static `form` that POSTs its fields as JSON to a URL and raises a toast —
 * no table, so a block carrying it installs into any app.
 */
/**
 * The form recipe draws its submit button shorter than its text fields. Beside
 * a field — the inline newsletter row — the mismatch reads as a mistake, so the
 * block forms lift the button to the field's height.
 */
const SUBMIT_MATCHES_FIELD = '[&_button[type=submit]]:h-10 [&_button[type=submit]]:px-4'

export const endpointForm = (options: {
  readonly url: string
  readonly submitLabel: string
  readonly successMessage: string
  readonly errorMessage: string
  readonly fields: readonly EndpointField[]
  readonly className?: string
}): BlockNode => ({
  type: 'form',
  props: { className: `${SUBMIT_MATCHES_FIELD} ${options.className ?? ''}`.trim() },
  endpoint: {
    url: options.url,
    method: 'POST',
    submitLabel: options.submitLabel,
    onSuccess: { type: 'toast', variant: 'success', message: options.successMessage },
    onError: { type: 'toast', variant: 'destructive', message: options.errorMessage },
  },
  fields: options.fields,
})

/**
 * Strips a form's own surface — its border, fill and padding — for a form that
 * already sits inside a card, so the card is not drawn twice. Marked important
 * because the form recipe's own classes are emitted beside these rather than
 * merged away.
 */
export const BARE_FORM = '!border-0 !bg-transparent !p-0'
