/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The config-component vocabulary every design-system specimen is built from.
 *
 * Extracted so the foundations specimens and the voice specimens can share ONE
 * set of builders rather than each growing its own. Nothing here is a new
 * component primitive ([internal ref] Rule #1): these are thin constructors over the
 * four types an operator already writes — `container`, `text`, `card`,
 * `divider` — and the renderer that draws them is the app's own.
 *
 * ─── WHY `style` AND NOT A UTILITY CLASS ────────────────────────────────────
 *
 * A specimen has to paint a value the CONFIG chose, and a runtime-composed
 * `bg-${token}` never enters the Tailwind candidate corpus: it is dropped from
 * the compiled CSS with no error, in dev and in the compiled binary alike. An
 * arbitrary `style` object survives — the props builder strips `style` from the
 * authored props and re-attaches it merged — so `extra` is how a specimen
 * reaches a token no fixed allowlist could have named ahead of time.
 *
 * Painting through `var(--color-<name>, <literal>)` rather than through the
 * literal alone is what keeps a swatch honest across schemes: `--color-<name>`
 * is the very registration `bg-<name>` resolves through, so the swatch flips
 * with the cascade exactly as the app does, and falls back to the document's
 * value only for a token the cascade never registered.
 */

import type { Component } from '@/domain/models/app/pages/components'

/** Anything a specimen may hang on an element beyond `className` / `data-testid`. */
export type ExtraProps = Readonly<Record<string, unknown>>

/** A `text` component. */
export const text = (element: string, className: string, content: string): Component =>
  ({ type: 'text', element, props: { className }, content }) as unknown as Component

/** A `container` component, optionally carrying a test id and extra props. */
export const box = (
  className: string,
  children: readonly Component[],
  testId?: string,
  extra?: ExtraProps
): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className,
      ...(testId === undefined ? {} : { 'data-testid': testId }),
      ...(extra ?? {}),
    },
    children,
  }) as unknown as Component

/** A `card` component. */
export const card = (className: string, children: readonly Component[]): Component =>
  ({ type: 'card', props: { className }, children }) as unknown as Component

/** A `divider` component. */
export const rule = (): Component =>
  ({ type: 'divider', props: { className: 'border-border' } }) as unknown as Component

/** A section heading. Never `h1` — the page owns the single top-level heading. */
export const sectionHeading = (label: string): Component =>
  text('h2', 'text-foreground text-lg font-semibold tracking-tight', label)

/** A quiet uppercase micro-label. */
export const microLabel = (label: string): Component =>
  text('p', 'text-foreground-subtle text-xs font-medium tracking-wider uppercase', label)

/** One line of explanation under a heading, at reading width. */
export const caption = (body: string, testId?: string): Component =>
  box('max-w-2xl', [text('p', 'text-foreground-subtle text-sm leading-relaxed', body)], testId)

/** One name/value row — the shape every token table uses. */
export const tokenRow = (name: string, value: string): Component =>
  box('border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0', [
    text('span', 'text-foreground font-mono text-sm', name),
    text('span', 'text-foreground-subtle font-mono text-sm', value),
  ])

/** A token table, or nothing when the group is empty. */
export const tokenTable = (
  title: string,
  rows: readonly (readonly [string, string])[]
): readonly Component[] =>
  rows.length === 0
    ? []
    : [
        box('flex flex-col gap-2', [
          microLabel(title),
          box(
            'flex flex-col',
            rows.map(([name, value]) => tokenRow(name, value))
          ),
        ]),
      ]

/** A labelled group of specimens laid out as a wrapping row. */
export const specimenGroup = (title: string, items: readonly Component[]): readonly Component[] =>
  items.length === 0
    ? []
    : [box('flex flex-col gap-3', [microLabel(title), box('flex flex-col gap-3', items)])]
