/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// FOUNDATIONS · one colour swatch — the colour filling it, its name, and per
// scheme every notation it can be read in, each copyable, with its contrast
// badge. Split from `foundations.ts`, which lays the swatches out.

import { kitType } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** One monospaced value, from a row or written out. */
const mono = (content: string, className: string): PageComponent =>
  ({ type: 'text', element: 'span', props: { className }, content }) as PageComponent

/**
 * The copy affordance beside a value — MARKUP ONLY, and that is the point.
 *
 * `copyCodeScript` is concatenated into every page's single body-end inline
 * script and is a delegated `document` handler keyed on three GENERIC selectors:
 * a `[data-code-copy-scope]` ancestor, a `[data-copy-code]` button inside it,
 * and the scope's FIRST `[data-copy-target]` as the payload. So a token value
 * becomes copyable by emitting the contract, with no new script and no island —
 * which is also the bound, since a clipboard write would otherwise spend a
 * page's whole island budget on something the platform already performs.
 *
 * shadcn's `icon-xs` ghost button: a 24 px target (WCAG 2.5.8) named by its
 * label, where a 10 px "copy" link was too small to hit and too faint to read
 * on a dark swatch. It takes the swatch's own ink, so it reads on any colour.
 */
const copyControl = (
  label: string,
  ink = 'text-foreground-subtle hover:text-foreground'
): PageComponent =>
  ({
    type: 'button',
    variant: 'ghost',
    size: 'icon-xs',
    icon: 'copy',
    props: {
      type: 'button',
      className: `${ink} shrink-0`,
      'data-copy-code': 'true',
      'data-copied-label': '$t:admin.common.copied',
      'aria-label': label,
      ...kitType('button'),
    },
  }) as PageComponent

/** The value block's own `data-copy-target`, which the notation below wraps. */
const copyTarget = (value: string, ink = 'text-foreground-subtle'): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: `${ink} font-mono text-sm`, 'data-copy-target': 'true' },
    content: value,
  }) as PageComponent

/**
 * One NOTATION of a colour: the value, and its own copy control.
 *
 * ONE scope per notation, which is forced rather than chosen. The delegated
 * handler reads the scope's FIRST `[data-copy-target]`, so two values under one
 * scope is one copyable value and one decoration — and a single button beside
 * two values cannot say which it took.
 */
const copyableNotation = (
  value: string,
  label: string,
  gate?: PageComponent['visibility'],
  ink?: { readonly value: string; readonly control: string }
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex items-center justify-between gap-2',
      'data-code-copy-scope': 'true',
    },
    ...(gate === undefined ? {} : { visibility: gate }),
    children: [copyTarget(value, ink?.value), copyControl(label, ink?.control)],
  }) as PageComponent

/**
 * The contrast badge beside an ink swatch: the measured ratio and its grade.
 *
 * COMPUTED upstream and never transcribed — `/tokens` measures the pair, and the
 * page composes the `:1` beside the number, which is what keeps a two-decimal
 * formatting choice out of a published contract.
 *
 * A pair that FAILS prints its failure rather than disappearing: a page that hid
 * every failing badge would be indistinguishable from one whose palette passes.
 * The verdict is two gated spans rather than one interpolated level, so `fail`
 * reads as the sentence an operator can act on.
 */
const contrastBadge = (input: {
  readonly ratio: string
  readonly against: string
  readonly level: string
  readonly token: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'bg-muted text-foreground-subtle mt-0.5 self-start rounded px-1 font-mono text-[10px]',
      'data-design-contrast': input.token,
      'data-design-contrast-level': input.level,
      'data-design-contrast-against': input.against,
    },
    children: [
      mono(`$t:admin.ds.found.on ${input.against} · ${input.ratio}:1 `, ''),
      {
        type: 'text',
        element: 'span',
        props: { className: '' },
        visibility: { record: { field: input.level.slice('$record.'.length), eq: 'fail' } },
        content: '$t:admin.ds.found.failsAa',
      } as PageComponent,
      {
        type: 'text',
        element: 'span',
        props: { className: '' },
        visibility: { record: { field: input.level.slice('$record.'.length), in: ['AA', 'AAA'] } },
        content: input.level,
      } as PageComponent,
    ],
  }) as PageComponent

/** The ink a swatch's own labels take: the swatch's, so they read on its colour. */
const ON_SWATCH = {
  value: 'opacity-90',
  control: 'text-current opacity-75 hover:bg-current/10 hover:text-current hover:opacity-100',
} as const

/**
 * One scheme's value block inside a swatch.
 *
 * `data-design-scheme` names the block so a reader of the DOM can address the
 * light and dark accounts separately; the gamut verdict sits on the BLOCK rather
 * than on the chip because a colour can be inside sRGB in one scheme and outside
 * it in the other, and one attribute cannot stand for two conversions.
 * `data-design-value-source` says who chose the value the dark block prints:
 * `declared`, `light` (a light-only colour kept in dark) or `platform` (the
 * dark default it falls back to).
 */
const schemeBlock = (input: {
  readonly scheme: 'light' | 'dark'
  readonly hex: string
  readonly value: string
  readonly gamutField: string
  readonly gamut: string
  readonly ratio: string
  readonly against: string
  readonly level: string
  readonly levelField: string
  readonly source?: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: input.scheme === 'light' ? 'dark:hidden flex-col' : 'hidden dark:flex flex-col',
      'data-design-scheme': input.scheme,
      'data-design-color-gamut': input.gamut,
      ...(input.source === undefined ? {} : { 'data-design-value-source': input.source }),
    },
    children: [
      copyableNotation(
        input.hex,
        `$t:admin.ds.found.copyHex $record.leaf (${input.hex})`,
        { record: { field: input.gamutField, eq: 'srgb' } },
        ON_SWATCH
      ),
      copyableNotation(
        input.value,
        `$t:admin.ds.found.copyValue $record.leaf (${input.value})`,
        undefined,
        ON_SWATCH
      ),
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-[10px] leading-snug opacity-75' },
        visibility: { record: { field: input.gamutField, eq: 'wide' } },
        content: '$t:admin.ds.found.outsideSrgb',
      } as PageComponent,
      // Who chose a dark value the app did not write, said in words beside it.
      ...(input.scheme === 'dark'
        ? [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-[10px] leading-snug opacity-75' },
              visibility: { record: { field: 'darkSource', eq: 'platform' } },
              content: '$t:admin.ds.found.darkFromPlatform',
            } as PageComponent,
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-[10px] leading-snug opacity-75' },
              visibility: { record: { field: 'darkSource', eq: 'light' } },
              content: '$t:admin.ds.found.darkKeptLight',
            } as PageComponent,
          ]
        : []),
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        // A POSITIVE gate over the closed verdict vocabulary, not an exclusion
        // of the two ways of saying "no verdict". A colour measured against
        // itself (`background`) carries no fields at all, and an ABSENT field
        // is neither `unmeasured` nor `''`, so an exclusion let that row
        // through and the badge printed its punctuation with nothing around it.
        visibility: { record: { field: input.levelField, in: ['fail', 'AA', 'AAA'] } },
        children: [
          contrastBadge({
            ratio: input.ratio,
            against: input.against,
            level: input.level,
            token: '$record.leaf',
          }),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * One swatch: the colour itself, FILLING the swatch, with its name and — per
 * scheme — every notation it can honestly be read in written ON it.
 *
 * The labels take the swatch's own ink (`ink` / `darkInk`: near-black or white,
 * whichever reads on the colour), so nothing paints over the colour but the
 * small contrast badge. A white card laid over most of the swatch left the
 * colour showing only as its frame.
 *
 * Content runs from the top, so the names along a row sit on one line whatever
 * each swatch carries beneath them; bottom-aligned, a swatch without a contrast
 * badge dropped its name lower than its neighbours. Each swatch fills its
 * grid cell, so a row's swatches end on one line too, contrast badge or not.
 *
 * Paint: `var(--color-<leaf>, …)`, so the swatch shows what the app paints. An
 * unregistered slot falls back to the value the row publishes for the scheme:
 * `value` in light, `darkValue` in dark — a declared dark colour, a light-only
 * one kept, or the platform dark default.
 */
export const swatch = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex h-full min-h-28 flex-col gap-1 rounded-md border p-2 [--swatch-fallback:var(--swatch-light)] [color:var(--swatch-ink)] dark:[--swatch-fallback:var(--swatch-dark)] dark:[color:var(--swatch-ink-dark)]',
      'data-testid': 'design-system-swatch-$record.leaf',
      style: {
        '--swatch-light': '$record.value',
        '--swatch-dark': '$record.darkValue',
        '--swatch-ink': '$record.ink',
        '--swatch-ink-dark': '$record.darkInk',
        backgroundColor: 'var(--color-$record.leaf, var(--swatch-fallback))',
      },
    },
    children: [
      mono('$record.leaf', 'font-mono text-sm font-medium'),
      schemeBlock({
        scheme: 'light',
        hex: '$record.hex',
        value: '$record.value',
        gamutField: 'gamut',
        gamut: '$record.gamut',
        ratio: '$record.contrastRatio',
        against: '$record.contrastAgainst',
        level: '$record.contrastLevel',
        levelField: 'contrastLevel',
      }),
      schemeBlock({
        scheme: 'dark',
        hex: '$record.darkHex',
        value: '$record.darkValue',
        gamutField: 'darkGamut',
        gamut: '$record.darkGamut',
        ratio: '$record.darkContrastRatio',
        against: '$record.darkContrastAgainst',
        level: '$record.darkContrastLevel',
        levelField: 'darkContrastLevel',
        source: '$record.darkSource',
      }),
    ],
  }) as PageComponent
