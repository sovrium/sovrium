/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * FOUNDATIONS — every token this app renders with, shown as the thing it is.
 *
 * ─── A SPECIMEN IS RENDERED AT ITS OWN VALUE, NOT DESCRIBED AT IT ───────────
 *
 * `8px` and `4rem` printed in a table are two strings; drawn as bars they are a
 * scale. `none` and `full` printed in a table are two strings; drawn as shapes
 * they are the entire content of a radius scale. Elevation cannot be read off a
 * table at all. So every group here draws, and prints its value beside the
 * drawing rather than instead of it.
 *
 * Because the value being drawn comes from the CONFIG, it reaches the element
 * through `style` and not through a utility class: a runtime-composed
 * `bg-${token}` never enters the Tailwind candidate corpus and is dropped from
 * the compiled CSS silently. See `design-system-specimen-primitives.ts`.
 *
 * ─── THE SWATCH PRINTS WHAT IT PAINTS, IN BOTH SCHEMES ──────────────────────
 *
 * The DTCG document is SINGLE-MODE: it describes the light cascade, and a
 * declared `theme.darkColors` is filed under `unmappable` because a single-mode
 * document has nowhere to put it. A dark preview built from that document alone
 * therefore paints near-black under a label reading the light value — the page
 * moves and the words do not.
 *
 * The fix is a SECOND value set for the dark render, read back out of the
 * document's own `unmappable` bucket, so the panel still has exactly one source
 * of truth. Three cases, and the third is the one that has to stay honest:
 *
 *  - the app declared a dark value    → print it; it is what `--color-<name>`
 *                                       resolves to under the dark cascade
 *  - the token is NOT a platform role → print the light value; `theme.colors`
 *                                       is mode-invariant by documented design,
 *                                       so a brand accent is the same colour in
 *                                       both schemes
 *  - a platform role, no dark value   → print {@link PLATFORM_DARK}. The v1 dark
 *                                       cascade re-points these to a different
 *                                       ramp step, and this module cannot know
 *                                       which without becoming a fourth copy of
 *                                       the ramp. Saying "the platform decides"
 *                                       is true; printing the light hex is not.
 *
 * The PAINT needs no such case analysis: every swatch is filled with
 * `var(--color-<slot>, <light value>)`, the exact registration `bg-<slot>`
 * resolves through, so it flips with the cascade the way the app does.
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import {
  INHERITED_COLOR_TOKENS,
  ROLE_COLOR_PROPERTY,
} from '@/domain/services/design-system/inherited-tokens'
import { formatColorValue } from '@/domain/services/design-system/token-values'
import {
  box,
  caption,
  microLabel,
  rule,
  sectionHeading,
  specimenGroup,
  text,
  tokenTable,
} from './design-system-specimen-primitives'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'
import type { Component } from '@/domain/models/app/pages/components'

/** Which cascade the preview is being rendered in. */
export type PreviewScheme = 'light' | 'dark'

/** The config path prefix a declared dark palette is filed under. */
const DARK_PREFIX = 'design.theme.darkColors.'

/** The config path prefix a declared shadow is filed under. */
const SHADOW_PREFIX = 'design.theme.shadows.'

/** What a platform role token prints in dark when the app declared no override. */
const PLATFORM_DARK = 'set by the platform dark cascade'

/** A running sentence, long enough to show how a face behaves across a line. */
const TYPE_SPECIMEN_SENTENCE =
  'The quick brown fox jumps over the lazy dog, and keeps reading long enough to show how this face sets a paragraph.'

/** Why several semantic roles resolve to one neutral value, said beside the proof. */
const SHARED_NEUTRAL_NOTE =
  'Some roles deliberately share one value. Colour here is reserved for consequence: ' +
  'success, warning and info stay neutral so that error — and only error — reads as loud. ' +
  'Two swatches showing the same value below is a decision, not an unfinished palette.'

/** The Sovrium guidance layer of a document. */
const guidanceOf = (
  document: Readonly<DesignSystemDocument>
): Readonly<{
  unmappable?: Readonly<Record<string, string>>
  inert?: readonly { readonly path: string; readonly declared: string; readonly reason: string }[]
}> => document.$extensions[SOVRIUM_EXTENSION_KEY]

/** Every `unmappable` entry under one config path, re-keyed by its trailing name. */
const bucketAt = (
  unmappable: Readonly<Record<string, string>>,
  prefix: string
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(unmappable).flatMap(([path, raw]) =>
      path.startsWith(prefix) ? [[path.slice(prefix.length), raw] as const] : []
    )
  )

/** The colour value of every token, in the shortest form an operator recognises. */
const colorValues = (document: Readonly<DesignSystemDocument>): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(document.color).map(([name, token]) => [name, formatColorValue(token.$value)])
  )

/** The custom property `bg-<name>` resolves through — identity unless the slot is renamed. */
const colorProperty = (name: string): string => ROLE_COLOR_PROPERTY[name] ?? name

/** The value a swatch may honestly print in the scheme being rendered. */
const printedColor = (
  name: string,
  light: string,
  dark: Readonly<Record<string, string>>,
  scheme: PreviewScheme
): string => {
  if (scheme === 'light') return light
  const declared = dark[name]
  if (declared !== undefined) return declared
  return name in INHERITED_COLOR_TOKENS ? PLATFORM_DARK : light
}

/**
 * One swatch: the colour itself, carrying its own name and value.
 *
 * The labels sit ON the painted surface, in a chip filled with the RAISED
 * surface token. They were filled with `bg-background` before, which punched
 * the page background straight through the colour being labelled — twice per
 * swatch, above 56px of transparent dead space.
 */
const swatch = (name: string, literal: string, printed: string): Component =>
  box(
    'border-border flex h-24 flex-col justify-end rounded-md border p-2',
    [
      box('bg-background-raised flex flex-col rounded px-2 py-1', [
        text('span', 'text-foreground font-mono text-xs', name),
        text('span', 'text-foreground-subtle font-mono text-xs', printed),
      ]),
    ],
    `design-system-swatch-${name}`,
    { style: { backgroundColor: `var(--color-${colorProperty(name)}, ${literal})` } }
  )

/** The colour section: every token in the document painted, none demoted to a row. */
const colorSection = (
  document: Readonly<DesignSystemDocument>,
  scheme: PreviewScheme
): readonly Component[] => {
  const values = colorValues(document)
  const dark = bucketAt(guidanceOf(document).unmappable ?? {}, DARK_PREFIX)
  return [
    sectionHeading('Colour'),
    box(
      'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5',
      Object.entries(values).map(([name, literal]) =>
        swatch(name, literal, printedColor(name, literal, dark, scheme))
      ),
      'design-system-swatches'
    ),
    caption(SHARED_NEUTRAL_NOTE, 'design-system-color-note'),
  ]
}

/** One spacing step, drawn at the width it measures. */
const spacingSpecimen = (name: string, value: string): Component =>
  box('flex items-center gap-3', [
    box('bg-primary h-2 shrink-0 rounded-sm', [], `design-system-spacing-${name}`, {
      style: { width: value },
    }),
    text('span', 'text-foreground-subtle font-mono text-xs', `${name} · ${value}`),
  ])

/** One radius step, drawn as a shape rounded to its own value. */
const radiusSpecimen = (name: string, value: string): Component =>
  box('flex flex-col items-center gap-1', [
    box('bg-primary-subtle border-border h-14 w-14 border', [], `design-system-radius-${name}`, {
      style: { borderRadius: value },
    }),
    text('span', 'text-foreground-subtle font-mono text-xs', name),
    text('span', 'text-foreground-subtle font-mono text-xs', value),
  ])

/** One elevation step, cast on a real surface. */
const shadowSpecimen = (name: string, value: string): Component =>
  box('flex flex-col gap-2', [
    box(
      'bg-background-raised border-border h-16 w-32 rounded-md border',
      [],
      `design-system-shadow-${name}`,
      { style: { boxShadow: value } }
    ),
    text('span', 'text-foreground-subtle font-mono text-xs', name),
    text('span', 'text-foreground-subtle font-mono text-xs', value),
  ])

/** One responsive threshold, declared or inherited. */
const breakpointSpecimen = (name: string, value: string): Component =>
  box(
    'border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0',
    [
      text('span', 'text-foreground font-mono text-sm', name),
      text('span', 'text-foreground-subtle font-mono text-sm', value),
    ],
    `design-system-breakpoint-${name}`
  )

/** One face, set in itself. */
const fontSpecimen = (name: string, stack: string): Component =>
  box(
    'border-border flex flex-col gap-1 border-b py-3 last:border-b-0',
    [
      text('p', 'text-foreground-subtle text-xs', `${name} · ${stack}`),
      text('p', 'text-foreground text-base leading-relaxed', TYPE_SPECIMEN_SENTENCE),
    ],
    `design-system-font-${name}`,
    { style: { fontFamily: stack } }
  )

/** A `{value, unit}` group, printed as the CSS string an author would write. */
const measures = (
  tokens: Readonly<
    Record<string, { readonly $value: { readonly value: number; readonly unit: string } }>
  >
): readonly (readonly [string, string])[] =>
  Object.entries(tokens).map(
    ([name, token]) => [name, `${token.$value.value}${token.$value.unit}`] as const
  )

/** Spacing, radius, breakpoints and duration — drawn where drawing says more. */
const measureSection = (document: Readonly<DesignSystemDocument>): readonly Component[] => [
  rule(),
  sectionHeading('Measure'),
  ...specimenGroup(
    'Spacing',
    measures(document.spacing).map(([name, value]) => spacingSpecimen(name, value))
  ),
  ...(Object.keys(document.radius).length === 0
    ? []
    : [
        box('flex flex-col gap-3', [
          microLabel('Radius'),
          box(
            'flex flex-wrap gap-4',
            measures(document.radius).map(([name, value]) => radiusSpecimen(name, value))
          ),
        ]),
      ]),
  ...specimenGroup(
    'Breakpoint',
    measures(document.breakpoint).map(([name, value]) => breakpointSpecimen(name, value))
  ),
  ...tokenTable('Duration', measures(document.duration)),
]

/** Elevation, read out of the bucket the DTCG document cannot type. */
const elevationSection = (document: Readonly<DesignSystemDocument>): readonly Component[] => {
  const shadows = bucketAt(guidanceOf(document).unmappable ?? {}, SHADOW_PREFIX)
  return Object.keys(shadows).length === 0
    ? []
    : [
        rule(),
        sectionHeading('Elevation'),
        caption(
          'DTCG has no form for an arbitrary box-shadow, so these are absent from the token ' +
            'document — which is exactly why they have to be cast here instead.'
        ),
        box(
          'flex flex-wrap gap-6',
          Object.entries(shadows).map(([name, value]) => shadowSpecimen(name, value))
        ),
      ]
}

/** The type section: one specimen sentence per face the app ships. */
const typeSection = (document: Readonly<DesignSystemDocument>): readonly Component[] => [
  rule(),
  sectionHeading('Type'),
  box(
    'flex flex-col',
    Object.entries(document.font).map(([name, token]) =>
      fontSpecimen(name, Array.isArray(token.$value) ? token.$value.join(', ') : token.$value)
    )
  ),
]

/** One inert declaration, with the value the author wrote and the reason it reaches nothing. */
const inertRow = (entry: {
  readonly path: string
  readonly declared: string
  readonly reason: string
}): Component =>
  box('border-border flex flex-col gap-1 border-b py-2 last:border-b-0', [
    box('flex items-baseline justify-between gap-4', [
      text('span', 'text-foreground font-mono text-sm', entry.path),
      text('span', 'text-foreground-subtle font-mono text-sm', entry.declared),
    ]),
    text('p', 'text-foreground-subtle text-sm leading-relaxed', entry.reason),
  ])

/**
 * What the engine received and did not turn into a token.
 *
 * The export has flagged both buckets since v1; the surface built for humans
 * showed neither, so an operator learned less from the console than an agent
 * learned from the JSON — and the one thing they most need (this line reaches
 * nothing, stop maintaining it) was exactly what was withheld.
 */
const disclosureSection = (document: Readonly<DesignSystemDocument>): readonly Component[] => {
  const guidance = guidanceOf(document)
  const inert = guidance.inert ?? []
  const unmappable = Object.entries(guidance.unmappable ?? {})
  if (inert.length === 0 && unmappable.length === 0) return []
  return [
    rule(),
    sectionHeading('Declared, and not a token'),
    caption(
      'Everything below is in the config and validated. None of it appears in the token ' +
        'document, for one of two reasons — so its absence there is never a sign it was ignored.'
    ),
    ...(inert.length === 0
      ? []
      : [
          box('flex flex-col gap-2', [
            microLabel('Inert — validated, then read by no renderer'),
            box('flex flex-col', inert.map(inertRow)),
          ]),
        ]),
    ...tokenTable(
      'Shipped, with no faithful DTCG form',
      unmappable.map(([path, raw]) => [path, raw] as const)
    ),
  ]
}

/**
 * The foundations panel, for the scheme it is being rendered in.
 *
 * @param document - the DTCG document, the SOLE source of every value shown.
 * @param scheme - the cascade the preview is painting under.
 */
export const foundationsSection = (
  document: Readonly<DesignSystemDocument>,
  scheme: PreviewScheme = 'light'
): readonly Component[] => [
  ...colorSection(document, scheme),
  ...measureSection(document),
  ...elevationSection(document),
  ...typeSection(document),
  ...disclosureSection(document),
]
