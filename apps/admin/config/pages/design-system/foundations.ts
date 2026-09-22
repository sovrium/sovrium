/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// FOUNDATIONS — every token this app renders with, drawn as the thing it is.
//
// ─── A SPECIMEN IS RENDERED AT ITS OWN VALUE, NOT DESCRIBED AT IT ──────────
//
// `8px` and `4rem` printed in a table are two strings; drawn as bars they are a
// scale. Elevation cannot be read off a table at all. So every family here
// DRAWS, and prints its value beside the drawing rather than instead of it. The
// value reaches the element through `style`, never through a composed utility
// class: a `bg-$record.leaf` never enters the Tailwind candidate corpus and is
// dropped from the compiled CSS silently.
//
// ─── EVERY VALUE COMES FROM `/tokens`, AND SO DOES EVERY GATE ──────────────
//
// One endpoint, read once per family through `?group=`, plus two reads of the
// same body by another key: `summary` as the page RECORD, and `discarded` as
// the rows of the closing disclosure. The four projections a config page cannot
// perform are published on the row — `leaf` (there is no string splitting), the
// hex conversion and gamut verdict, the two contrast measurements, and the
// `fontSize` member of a typography composite, which `value` renders as one
// unsplittable string.
//
// ─── THE CHIP SHIPS BOTH SCHEMES AND CSS PICKS ONE ────────────────────────
//
// The scheme is the operator's stored preference (`localStorage.theme` →
// `html.dark`), which a server render cannot read. So every swatch carries TWO
// value blocks — each with its own notations, gamut and contrast badge — and the
// `dark:` variant shows exactly one. A single server-resolved block would leave
// the page painting one colour and printing another the moment the toggle moved.
//
// ─── `?scheme=` IS A DEEP LINK, AND IT RESOLVES ON THE CLIENT ─────────────
//
// The retired builder emitted a head script only when the server saw the query.
// A config page cannot vary its scripts per request, so the script reads
// `location.search` itself — same head position, same pre-paint timing, and it
// now works on every page of the section rather than on the two a builder still
// served. It writes nothing to storage: a link is not a preference.

import {
  DESIGN_COVERAGE_ENDPOINT,
  DESIGN_TOKENS_ENDPOINT,
  DESIGN_TYPE_LADDER_ENDPOINT,
} from '../../systemSources'
import { withShell } from '../../components/shell'
import { SCHEME_DEEP_LINK_SCRIPT, designSystemBreadcrumb } from './chrome'
import {
  MEASURE_LG,
  MEASURE_MD,
  MEASURE_SM,
  anchoredSection,
  kitType,
  microLabel,
  railedConsoleBody,
} from './sections'
import type { RailSection } from './sections'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** This page's own slug and the noun it carries in the trail and the `h1`. */
const SLUG = 'foundations'
const TITLE = 'Foundations'

/**
 * The seven regions, in reading order — the rail is derived from this list.
 *
 * ─── SEVEN PROPERTIES, ONE DESIGN KEY EACH ─────────────────────────────────
 *
 * The page used to head TEN regions for SEVEN keys, because three of them named
 * a RENDERING rather than a property: `Type scale` and `Emphasis` are both
 * `design.typeScale`, and `Surfaces` is what `design.elevation` is for. A reader
 * counting the headings counted ten things to configure and there were seven.
 *
 * Nothing is dropped — the ladder, the emphasis registers and the face
 * specimens all sit inside `Type`, and the surface pair inside `Elevation`. What
 * changed is that a heading now names a key you can go and write.
 *
 * The order is an argument. Colour first because it is what a reader came for;
 * then type; then the three that describe a box, loosest to tightest — space,
 * shape, elevation; motion after everything that is still; breakpoints last,
 * because they are the only one about the window rather than the page.
 */
const SECTIONS: readonly RailSection[] = [
  { id: 'colour', title: 'Colour' },
  { id: 'type', title: 'Type' },
  { id: 'space', title: 'Space' },
  { id: 'shape', title: 'Shape' },
  { id: 'elevation', title: 'Elevation' },
  { id: 'motion', title: 'Motion' },
  { id: 'breakpoints', title: 'Breakpoints' },
]

/** A region, addressed by name rather than by its position in the list above. */
const region = (id: string): RailSection => SECTIONS.find((entry) => entry.id === id) as RailSection

/** One token family, as rows. */
const tokenRows = (group: string) => ({
  system: { endpoint: DESIGN_TOKENS_ENDPOINT, query: { group }, rowsKey: 'items', idKey: 'path' },
})

/** One layer of the coverage ledger, as the single row that answers its gate. */
const coverageRow = (key: string) => ({
  system: { endpoint: DESIGN_COVERAGE_ENDPOINT, query: { key }, rowsKey: 'items', idKey: 'key' },
})

/** A line of body copy at the size the section notes are set in. */
const note = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
    content,
  }) as PageComponent

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
 */
const copyControl = (label: string): PageComponent =>
  ({
    type: 'button',
    variant: 'link',
    props: {
      type: 'button',
      className:
        'text-foreground-subtle hover:text-foreground shrink-0 font-mono text-[10px] leading-none',
      'data-copy-code': 'true',
      'data-copied-label': 'Copied',
      'aria-label': label,
      ...kitType('button'),
    },
    content: 'copy',
  }) as PageComponent

/** The value block's own `data-copy-target`, which the notation below wraps. */
const copyTarget = (value: string): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: { className: 'text-foreground-subtle font-mono text-sm', 'data-copy-target': 'true' },
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
  gate?: PageComponent['visibility']
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex items-baseline justify-between gap-2',
      'data-code-copy-scope': 'true',
    },
    ...(gate === undefined ? {} : { visibility: gate }),
    children: [copyTarget(value), copyControl(label)],
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
        'bg-background-subtle text-foreground-subtle mt-0.5 self-start rounded px-1 font-mono text-[10px]',
      'data-design-contrast': input.token,
      'data-design-contrast-level': input.level,
      'data-design-contrast-against': input.against,
    },
    children: [
      mono(`on ${input.against} · ${input.ratio}:1 `, ''),
      {
        type: 'text',
        element: 'span',
        props: { className: '' },
        visibility: { record: { field: input.level.slice('$record.'.length), eq: 'fail' } },
        content: 'fails AA',
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

/**
 * One scheme's value block inside a swatch.
 *
 * `data-design-scheme` names the block so a reader of the DOM can address the
 * light and dark accounts separately; the gamut verdict sits on the BLOCK rather
 * than on the chip because a colour can be inside sRGB in one scheme and outside
 * it in the other, and one attribute cannot stand for two conversions.
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
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: input.scheme === 'light' ? 'dark:hidden flex-col' : 'hidden dark:block flex-col',
      'data-design-scheme': input.scheme,
      'data-design-color-gamut': input.gamut,
    },
    children: [
      copyableNotation(input.hex, `Copy the hex value (${input.hex})`, {
        record: { field: input.gamutField, eq: 'srgb' },
      }),
      copyableNotation(input.value, `Copy the declared value (${input.value})`),
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[10px] leading-snug' },
        visibility: { record: { field: input.gamutField, eq: 'wide' } },
        content: 'Outside sRGB — no faithful hex',
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        // A POSITIVE gate over the closed verdict vocabulary, not an exclusion
        // of the two ways of saying "no verdict". `background` is the ground
        // itself, so `/tokens` measures it against nothing and OMITS the fields
        // rather than emptying them — and an ABSENT field is neither
        // `unmeasured` nor `''`, so the exclusion let that one row through and
        // the badge printed its punctuation with nothing around it: `on  · :1`.
        // A closed set refuses absence by construction.
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
 * One swatch: the colour itself, carrying its own name and — per scheme — every
 * notation it can honestly be read in.
 *
 * The labels sit ON the painted surface, in a chip filled with the RAISED
 * surface token. Filling them with `bg-background` punches the page background
 * straight through the colour being labelled, twice per swatch.
 *
 * The paint is `var(--color-<leaf>, <value>)` — the exact registration
 * `bg-<slot>` resolves through — so it flips with the cascade the way the app
 * does, and falls back to the declared literal for a slot registered under
 * another name.
 */
const swatch = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex min-h-24 flex-col justify-end rounded-md border p-2',
      'data-testid': 'design-system-swatch-$record.leaf',
      style: { backgroundColor: 'var(--color-$record.leaf, $record.value)' },
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'bg-background-raised flex flex-col rounded px-2 py-1' },
        children: [
          mono('$record.leaf', 'text-foreground font-mono text-sm'),
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
            hex: '$record.darkHex|$record.hex',
            value: '$record.dark|$record.value',
            gamutField: 'darkGamut',
            gamut: '$record.darkGamut|$record.gamut',
            ratio: '$record.darkContrastRatio',
            against: '$record.darkContrastAgainst',
            level: '$record.darkContrastLevel',
            levelField: 'darkContrastLevel',
          }),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * Why the contrast badges are missing from a dark palette the app never
 * declared — said ONCE, above the grid.
 *
 * Not computing a ratio is honest; dropping the badge with it is not. The reader
 * would be left with a swatch, a value and no account of its contrast, and the
 * only available conclusion is that the ratio was fine. One line, not twenty-one
 * "unmeasured" badges.
 *
 * Gated on the PAGE record — `summary.darkDeclared` — because that is the one
 * question no rows binding answers: zero declared dark colours still render
 * twenty-one rows, and there is nothing left to gate on. Shipped whenever the
 * state holds and SHOWN only in dark, since this render cannot see the reader's
 * stored preference.
 */
const darkContrastNote = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'max-w-2xl hidden dark:block',
      'data-testid': 'design-system-dark-contrast-note',
    },
    visibility: { record: { field: 'darkDeclared', eq: false } },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed` },
        content:
          'This app declares no dark colours, so these values come from the platform cascade and ' +
          'cannot be measured here. Declare design.darkColors to publish dark values and their ' +
          'contrast.',
      },
    ],
  }) as PageComponent

/**
 * One chip of the data series, painted from the variable the charts read.
 *
 * Drawn from `var(--sv-chart-N)` rather than from the token endpoint, because
 * the series is not in the token document: it is emitted into the stylesheet and
 * has no DTCG form. Painting it here is the only way a reader learns what a
 * five-series chart will look like before drawing one — and the value on screen
 * is the value the chart uses, because it is the same variable.
 */
const seriesChip = (index: number): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col items-center gap-1.5' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border h-12 w-12 rounded-md border',
          style: { backgroundColor: `var(--sv-chart-${index})` },
          'data-design-series-slot': String(index),
        },
        children: [],
      } as PageComponent,
      mono(`chart-${index}`, 'text-foreground-subtle font-mono text-[11px]'),
    ],
  }) as PageComponent

/**
 * The data series — the one place in this system where hue is designed.
 *
 * Everywhere else colour is spent on consequence and nothing else. A chart is
 * the exception the rule needs: five categories have to be told apart, and
 * nothing but hue tells them apart. The first slot is the informational hue, so
 * an informational mark and the first series are the same colour a reader has
 * already learned rather than two blues that nearly match.
 */
const seriesBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-series': 'true' },
    children: [
      microLabel('Data series'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap gap-4' },
        children: [1, 2, 3, 4, 5].map((index) => seriesChip(index)),
      } as PageComponent,
    ],
  } as PageComponent,
]

/** One state of the vocabulary, drawn as the mark a reader actually meets. */
const stateChip = (input: {
  readonly name: string
  readonly glyph: string
  readonly className: string
}): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `border-border flex items-center gap-2 rounded-md border px-3 py-1.5 ${input.className}`,
      'data-design-state': input.name,
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-md leading-none' },
        content: input.glyph,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-md' },
        content: input.name,
      },
    ],
  }) as PageComponent

/**
 * The state vocabulary, and the reason three quarters of it is grey.
 *
 * Success, warning and info are told by their glyph and their wording; only
 * error carries colour. That is not restraint for its own sake — it is what
 * makes error legible. A palette where four states each shout in their own hue
 * has no way left to say "this one stopped".
 */
const stateVocabularyBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-state-vocabulary': 'true' },
    children: [
      microLabel('State'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap gap-3' },
        children: [
          stateChip({ name: 'success', glyph: '✓', className: 'text-foreground' }),
          stateChip({ name: 'warning', glyph: '!', className: 'text-foreground' }),
          stateChip({ name: 'info', glyph: 'i', className: 'text-foreground' }),
          stateChip({
            name: 'error',
            glyph: '×',
            className: 'border-error-border bg-error-bg text-error-fg',
          }),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/**
 * The density demo — the only thing on this page that shows a token CHANGING a
 * component rather than being one.
 *
 * Every other region draws a value: a colour, a radius, a duration. Space is
 * different, because a spacing token is invisible until something sits inside
 * it. So the two control heights are drawn as the controls they set, at the
 * exact variable the recipes read — move `design.density` and these two boxes
 * move with every button and every field in the app.
 */
const densityBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-density-demo': 'true' },
    children: [
      microLabel('Density'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-end gap-4' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-1.5' },
            children: [
              {
                // The specimen demonstrates a HEIGHT, so it must not also
                // demonstrate the primary fill a variant-less button inherits:
                // the box is drawn by its own border and nothing else.
                type: 'button',
                variant: 'outline',
                props: {
                  type: 'button',
                  disabled: true,
                  className:
                    'border-border text-foreground inline-flex items-center rounded-md border px-3',
                  style: { height: 'var(--sv-density-button-h)' },
                  'data-design-density-slot': 'button-h',
                },
                content: 'Small button',
              },
              mono('density.buttonH', 'text-foreground-subtle font-mono text-[11px]'),
            ],
          } as PageComponent,
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-1.5' },
            children: [
              {
                type: 'container',
                element: 'div',
                props: {
                  className:
                    'border-border bg-background-raised text-foreground-subtle flex items-center rounded-md border px-3 text-md',
                  style: { height: 'var(--sv-density-control-h)' },
                  'data-design-density-slot': 'control-h',
                },
                children: [
                  {
                    type: 'text',
                    element: 'span',
                    props: { className: 'text-md' },
                    content: 'A field, at control height',
                  },
                ],
              } as PageComponent,
              mono('density.controlH', 'text-foreground-subtle font-mono text-[11px]'),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Colour: every token in the document painted, none demoted to a row. */
const colourSection = (): PageComponent =>
  anchoredSection(region('colour'), [
    darkContrastNote(),
    {
      type: 'container',
      element: 'div',
      props: {
        // ─── THE CONSOLE'S BREAKPOINTS ARE NOT THE VIEWPORT'S ──────────────
        //
        // A swatch carries a hex, an oklch triple and a copy affordance on one
        // row, so it needs ~220px to hold them. The old ladder (2 / sm:3 / lg:5)
        // read the VIEWPORT, but every console page sits inside a fixed 256px
        // sidebar and a 40px gutter — so at `sm` (640px) this grid is ~340px
        // wide and three columns gave each card 100px, with the value and its
        // control overlapping. Measured at 375px it was 214px for two.
        //
        // The steps are therefore shifted a breakpoint later than a full-width
        // page would use: one column until `md`, four only at `xl`.
        className: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4',
        'data-testid': 'design-system-swatches',
        'data-design-role-table': 'true',
      },
      dataSource: tokenRows('color'),
      children: [swatch()],
    } as PageComponent,
    ...seriesBlock(),
    ...stateVocabularyBlock(),
  ])

/** The sentence every face is set in, long enough to show how it sets a paragraph. */
const TYPE_SPECIMEN_SENTENCE =
  'The quick brown fox jumps over the lazy dog, and keeps reading long enough to show how this ' +
  'face sets a paragraph.'

/** Type: one specimen per declared face, set in that face. */
const typeSection = (): PageComponent =>
  anchoredSection(region('type'), [
    microLabel('Faces'),
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col' },
      dataSource: tokenRows('font'),
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border flex flex-col gap-1 border-b py-3 last:border-b-0',
            'data-testid': 'design-system-font-$record.leaf',
            style: { fontFamily: '$record.value' },
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground-subtle text-sm' },
              content: '$record.leaf · $record.value',
            },
            {
              type: 'text',
              element: 'p',
              props: { className: `text-foreground ${MEASURE_LG} text-lg leading-relaxed` },
              content: TYPE_SPECIMEN_SENTENCE,
            },
          ],
        } as PageComponent,
      ],
    } as PageComponent,
    microLabel('Ladder'),
    ...typeScaleBlock(),
    microLabel('Emphasis'),
    ...emphasisBlock(),
  ])

/** The one sentence every ladder step is set in. */
const LADDER_SENTENCE = 'The quick brown fox jumps over the lazy dog'

/** Where an author reads what declaring a type scale buys them. */
const TYPE_SCALE_DOC_HREF = 'https://sovrium.com/en/docs/design-type-scale'

/**
 * One PLATFORM ladder row.
 *
 * The row must CARRY the utility class and must NOT carry an inline font-size:
 * `-052` reads the computed size off the element and compares it with the
 * printed pair, so a row printing `16 / 24` while set inline at 16px would agree
 * with itself while the utility resolved to something else. `utility` is
 * published beside `step` because a config page cannot split `text-3xl`.
 */
const platformStep = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border $record.utility flex flex-col gap-1 border-b py-3 last:border-b-0 md:flex-row md:items-baseline md:gap-6',
      'data-design-platform-step': '$record.step',
    },
    children: [
      mono('$record.utility', 'text-foreground-subtle w-[90px] shrink-0 font-mono text-[11px]'),
      mono(
        '$record.sizePx / $record.leadingPx',
        'text-foreground-subtle w-[70px] shrink-0 font-mono text-[11px]'
      ),
      mono(LADDER_SENTENCE, 'text-foreground min-w-0 flex-1'),
    ],
  }) as PageComponent

/**
 * The platform ladder, drawn only for an app that declared no scale of its own.
 *
 * Showing it does not cross "never tell an operator they declared something they
 * did not", because the absence is stated in the same breath and the rows carry
 * their own hook. Withholding it left an operator with a stated gap and no way
 * to learn what their own page renders at.
 *
 * Since the ladder moved into Tailwind's `--text-*` namespace these rungs are
 * Sovrium's own values rather than a borrowed table, so the rows below are the
 * whole answer to "what size is my text" and there is no longer a set of pinned
 * literals sitting outside them. The block that disclosed those three sizes was
 * deleted with them.
 */
const platformLadder = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      microLabel('Platform ladder, in force'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: {
          system: { endpoint: DESIGN_TYPE_LADDER_ENDPOINT, rowsKey: 'items', idKey: 'step' },
        },
        children: [platformStep()],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * One DECLARED ladder step, set at the size it names.
 *
 * A ladder listing `2.75rem` while rendering every row at the same size shows a
 * scale without demonstrating one. `fontSize` is published on its own because
 * `value` renders the typography composite as one string a config page has no
 * way to cut, and `$record.` admits no dots.
 */
const declaredStep = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex flex-col gap-2 border-b py-4 last:border-b-0 md:flex-row md:items-baseline md:gap-6',
      'data-design-type-step': '$record.leaf',
    },
    children: [
      mono('$record.leaf', 'text-foreground-subtle w-[90px] shrink-0 font-mono text-sm'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'min-w-0 flex-1' },
        children: [
          {
            type: 'text',
            element: 'p',
            props: {
              className: 'text-foreground',
              'data-design-type-specimen': '$record.leaf',
              style: { fontSize: '$record.fontSize', lineHeight: '$record.lineHeight' },
            },
            content: LADDER_SENTENCE,
          },
        ],
      } as PageComponent,
      mono(
        '$record.fontSize / $record.lineHeight · text-$record.leaf',
        'text-foreground-subtle shrink-0 font-mono text-sm md:text-right'
      ),
    ],
  }) as PageComponent

/** The ladder, and the emphasis registers, both of them `design.typeScale`. */
const typeScaleBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3',
      'data-testid': 'design-system-type-scale',
      'data-design-type-ladder': 'true',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: tokenRows('typography'),
        children: [declaredStep()],
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        dataSource: coverageRow('type-scale'),
        children: [
          // Gated on the layer's own COUNT, not on `declared`.
          //
          // `declared` is true for an app that wrote `typeScale.families` and
          // no step at all — families and steps share a parent key — so the
          // disclosure vanished for exactly the app it was written for, and
          // the region rendered blank. A reader who declared a font and no
          // ladder was told nothing rather than told which key to write,
          // which is a worse failure than the borrowed ladder this whole
          // block exists to prevent. Families are their own coverage layer;
          // reading them here counted one key twice.
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-3' },
            visibility: { record: { field: 'count', eq: 0 } },
            children: [
              note(
                'This app declares no type scale, so text renders at the platform ladder ' +
                  'below and no named step of its own is emitted.'
              ),
              {
                type: 'link',
                props: {
                  href: TYPE_SCALE_DOC_HREF,
                  className:
                    'text-foreground hover:text-foreground-muted self-start text-sm font-medium',
                },
                content: 'Declare design.typeScale.steps to publish your own →',
              },
              platformLadder(),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Spacing: a rhythm, drawn at the width each step measures. */
const spacingBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-3' },
    dataSource: tokenRows('spacing'),
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-center gap-3' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'bg-primary h-2 shrink-0 rounded-sm',
              'data-testid': 'design-system-spacing-$record.leaf',
              style: { width: '$record.value' },
            },
            children: [],
          },
          mono('$record.leaf · $record.value', 'text-foreground-subtle font-mono text-sm'),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'contents' },
    dataSource: coverageRow('spacing'),
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'contents' },
        visibility: { record: { field: 'declared', eq: false } },
        children: [
          note(
            'This app declares no spacing scale. Sovrium components space themselves with ' +
              'Tailwind utilities rather than through a token, so there is nothing to override ' +
              'until you declare design.spacing.'
          ),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Radius: a shape, drawn as one. */
const radiusBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-wrap gap-4', 'data-design-radius-ladder': 'true' },
    dataSource: tokenRows('radius'),
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col items-center gap-1' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'bg-primary-subtle border-border h-14 w-14 border',
              'data-testid': 'design-system-radius-$record.leaf',
              style: { borderRadius: '$record.value' },
            },
            children: [],
          },
          mono('$record.leaf', 'text-foreground-subtle font-mono text-sm'),
          mono('$record.value', 'text-foreground-subtle font-mono text-sm'),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Breakpoints: the one family an author cannot learn from their own config. */
const breakpointsBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col', 'data-design-breakpoint-list': 'true' },
    dataSource: tokenRows('breakpoint'),
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0',
          'data-testid': 'design-system-breakpoint-$record.leaf',
        },
        children: [
          mono('$record.leaf', 'text-foreground font-mono text-md'),
          mono('$record.value', 'text-foreground-subtle font-mono text-md'),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Shadow: an elevation, cast rather than listed. */
const shadowBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: {
      className: 'bg-background-subtle border-border flex flex-wrap gap-6 rounded-lg border p-5',
      'data-design-elevation-stack': 'true',
    },
    dataSource: tokenRows('shadow'),
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-2' },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: 'bg-background-raised border-border h-16 w-32 rounded-md border',
              'data-testid': 'design-system-shadow-$record.leaf',
              style: { boxShadow: '$record.value' },
            },
            children: [],
          },
          mono('$record.leaf', 'text-foreground-subtle font-mono text-sm'),
          mono('$record.value', 'text-foreground-subtle font-mono text-sm'),
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** Motion: durations as a table, curves as drawings of themselves. */
const motionBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-durations': 'true' },
    children: [
      microLabel('Duration'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: tokenRows('duration'),
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className:
                'border-border flex items-baseline justify-between gap-4 border-b px-2 py-[5px] last:border-b-0',
              'data-testid': 'design-system-duration-$record.leaf',
            },
            children: [
              mono('$record.leaf', 'text-foreground font-mono text-[11px]'),
              mono('$record.value', 'text-foreground-subtle font-mono text-[11px]'),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-easing-curves': 'true' },
    children: [
      microLabel('Easing'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap gap-6' },
        dataSource: tokenRows('easing'),
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              // `text-base` because the curve renderer names its token in a
              // `<figcaption>` that rules no step of its own: without it the
              // three easing names inherit the document root and read a step
              // larger than every other label on the page.
              className: 'flex flex-col items-center gap-1.5 text-base',
              'data-testid': 'design-system-easing-$record.leaf',
            },
            children: [
              {
                // The public `swatch` kit type in its `curve` mode: a static
                // SVG plot of the easing token, not an island and not a
                // chart, so a page documenting a duration pulls no chunk.
                type: 'swatch',
                variant: 'curve',
                token: '$record.leaf',
                label: '$record.leaf',
                size: 64,
                props: {
                  className: 'text-foreground m-0 flex flex-col items-center gap-1',
                  ...kitType('swatch'),
                },
              },
              mono('$record.leaf', 'text-foreground-subtle font-mono text-[11px]'),
            ],
          } as PageComponent,
        ],
      } as PageComponent,
    ],
  } as PageComponent,
]

/** One labelled demonstration inside the two assembled sections. */
const inPlace = (label: string, children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-3' },
    children: [microLabel(label), ...children],
  }) as PageComponent

/** Surfaces: what the values look like assembled, rather than listed. */
const surfacesBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'grid gap-4 md:grid-cols-2' },
    children: [
      inPlace('Card on the page background', [
        {
          type: 'container',
          element: 'article',
          props: {
            className:
              'border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-4',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground text-md font-medium' },
              content: 'Raised surface',
            },
          ],
        } as PageComponent,
      ]),
      inPlace('Subtle surface', [
        {
          type: 'container',
          element: 'div',
          props: {
            className:
              'border-border bg-background-subtle flex flex-col gap-2 rounded-lg border p-4',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground text-md font-medium' },
              content: 'Subtle surface',
            },
          ],
        } as PageComponent,
      ]),
    ],
  } as PageComponent,
]

/** One emphasis register, set in the class it documents. */
const emphasisRow = (label: string, bodyClass: string, body: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-b py-2 last:border-b-0' },
    children: [
      microLabel(label),
      {
        type: 'text',
        element: 'p',
        props: { className: `${bodyClass} leading-relaxed` },
        content: body,
      },
    ],
  }) as PageComponent

/** Emphasis: the three registers of ink, each set in its own. */
const emphasisBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col' },
    children: [
      emphasisRow(
        'Primary',
        'text-foreground text-md font-medium',
        'The one action a reader is meant to take on this screen.'
      ),
      emphasisRow(
        'Muted',
        'text-foreground-muted text-md',
        'Present, readable, and clearly not the thing to click.'
      ),
      emphasisRow(
        'Disabled',
        'text-foreground-disabled text-md',
        'Visible so its position is stable, dimmed so it reads as inert.'
      ),
    ],
  } as PageComponent,
]

/** Space: the rhythm, and the one place a token is shown CHANGING a component. */
const spaceSection = (): PageComponent =>
  anchoredSection(region('space'), [...spacingBlock(), ...densityBlock()])

/** Shape: a radius, drawn as one. */
const shapeSection = (): PageComponent => anchoredSection(region('shape'), radiusBlock())

/** Elevation: what a surface lifts off, cast rather than listed, then assembled. */
const elevationSection = (): PageComponent =>
  anchoredSection(region('elevation'), [...shadowBlock(), ...surfacesBlock()])

/** Motion: durations as a table, curves as drawings of themselves. */
const motionSection = (): PageComponent => anchoredSection(region('motion'), motionBlock())

/** Breakpoints: the one family an author cannot learn from their own config. */
const breakpointsSection = (): PageComponent =>
  anchoredSection(region('breakpoints'), breakpointsBlock())

/**
 * What the engine received and did NOT turn into a token.
 *
 * The export has flagged both buckets since v1; a surface built for humans that
 * showed neither taught an operator less than the JSON built for agents taught
 * an agent — and the one thing they most need (this line reaches nothing, stop
 * maintaining it) was exactly what was withheld.
 *
 * `discarded` rides on the same body as the token rows and carries its own
 * `kind`, so the two buckets are one binding read twice under different gates
 * rather than two endpoints that could disagree about what was discarded.
 */
const discardedRows = () => ({
  system: { endpoint: DESIGN_TOKENS_ENDPOINT, rowsKey: 'discarded', idKey: 'path' },
})

/** One discarded declaration, with the value the author wrote. */
const discardedRow = (kind: 'inert' | 'unmappable'): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-b py-2 last:border-b-0' },
    visibility: { record: { field: 'kind', eq: kind } },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-baseline justify-between gap-4' },
        children: [
          mono('$record.path', 'text-foreground font-mono text-md'),
          mono('$record.declared', 'text-foreground-subtle font-mono text-md'),
        ],
      } as PageComponent,
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed` },
        content: '$record.reason',
      },
    ],
  }) as PageComponent

/** The closing disclosure: declared, validated, and not a token. */
const disclosureSection = (): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'h3',
    props: { className: 'text-foreground text-md font-semibold tracking-tight' },
    content: 'Declared, and not a token',
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      microLabel('Inert — validated, then read by no renderer'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: discardedRows(),
        children: [discardedRow('inert')],
      } as PageComponent,
    ],
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      microLabel('Shipped, with no faithful DTCG form'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: discardedRows(),
        children: [discardedRow('unmappable')],
      } as PageComponent,
    ],
  } as PageComponent,
]

const foundations: PageConfig = withShell(
  {
    id: 'design-system-foundations',
    name: 'design-system-foundations',
    path: `/design-system/${SLUG}`,
    meta: {
      lang: 'en-US',
      title: TITLE,
      description:
        'Every token this app renders with, drawn at the value it resolves to in the scheme you ' +
        'are reading.',
    },
    scripts: { inlineScripts: [{ code: SCHEME_DEEP_LINK_SCRIPT, position: 'head' }] },
    // The ONE gate no rows binding can answer: whether this app declared a dark
    // palette at all. Zero declared dark colours still render twenty-one token
    // rows, so there is nothing left for a row gate to test.
    dataSource: {
      system: { endpoint: DESIGN_TOKENS_ENDPOINT, recordKey: 'summary', idKey: 'total' },
    },
    components: railedConsoleBody({
      title: TITLE,
      sections: SECTIONS,
      children: [
        // No hairline between sections. Seven of them drew a line across a
        // page whose sections are already named, anchored and spaced — the
        // rule said nothing the heading below it did not, and cost 198px of
        // page. The surface separates by space.
        colourSection(),
        typeSection(),
        spaceSection(),
        shapeSection(),
        elevationSection(),
        motionSection(),
        breakpointsSection(),
        ...disclosureSection(),
      ],
    }),
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
  }
)

export default foundations
