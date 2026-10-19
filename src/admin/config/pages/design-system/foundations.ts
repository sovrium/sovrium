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

import { ledgerTable } from '../../components/data-table-blocks'
import { withShell } from '../../components/shell'
import {
  DESIGN_COVERAGE_ENDPOINT,
  DESIGN_TOKENS_ENDPOINT,
  DESIGN_TYPE_LADDER_ENDPOINT,
} from '../../system-sources'
import { SCHEME_DEEP_LINK_SCRIPT, designSystemDocumentShell } from './chrome'
import { swatch } from './foundations-swatch'
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
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** This page's own slug and the noun it carries in the trail and the `h1`. */
const SLUG = 'foundations'
const TITLE = '$t:admin.common.foundations'

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
  { id: 'colour', title: '$t:admin.ds.found.colour' },
  { id: 'type', title: '$t:admin.common.type' },
  { id: 'space', title: '$t:admin.ds.found.space' },
  { id: 'shape', title: '$t:admin.ds.found.shape' },
  { id: 'elevation', title: '$t:admin.ds.found.elevation' },
  { id: 'motion', title: '$t:admin.ds.found.motion' },
  { id: 'breakpoints', title: '$t:admin.ds.found.breakpoints' },
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
 * Where the dark values come from on an app that declared no dark palette —
 * said ONCE, above the grid. Every swatch still prints and measures a dark
 * value (its light one kept, or the platform default it falls back to); the
 * note names the key that would let the author choose their own.
 *
 * Gated on the PAGE record — `summary.darkDeclared` — because no rows binding
 * answers an app-level fact. Shipped whenever the state holds and SHOWN only in
 * dark, since this render cannot see the reader's stored preference.
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
        content: '$t:admin.ds.found.noDark',
      },
    ],
  }) as PageComponent

/**
 * One chip of the data series, painted from the variable the charts read.
 *
 * Drawn from `var(--chart-N)` rather than from the token endpoint, because
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
          style: { backgroundColor: `var(--chart-${index})` },
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
      microLabel('$t:admin.ds.found.series'),
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
      microLabel('$t:admin.common.state'),
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
      microLabel('$t:admin.ds.found.density'),
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
                content: '$t:admin.ds.found.smallButton',
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
                    'border-border bg-card text-foreground-subtle flex items-center rounded-md border px-3 text-md',
                  style: { height: 'var(--sv-density-control-h)' },
                  'data-design-density-slot': 'control-h',
                },
                children: [
                  {
                    type: 'text',
                    element: 'span',
                    props: { className: 'text-md' },
                    content: '$t:admin.ds.found.fieldSample',
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

/** The swatch grid. One column until `md`: the console loses a 256px sidebar. */
const swatchGrid = (): PageComponent =>
  ({
    type: 'container',
    props: {
      className: 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4',
      'data-testid': 'design-system-swatches',
      'data-design-role-table': 'true',
    },
    dataSource: tokenRows('color'),
    children: [swatch()],
  }) as PageComponent

/** Colour: every token in the document painted, none demoted to a row. */
const colourSection = (): PageComponent =>
  anchoredSection(region('colour'), [
    darkContrastNote(),
    swatchGrid(),
    ...seriesBlock(),
    ...stateVocabularyBlock(),
  ])

/** The sentence every face is set in, long enough to show how it sets a paragraph. */
const TYPE_SPECIMEN_SENTENCE = '$t:admin.ds.found.paragraph'

/** Type: one specimen per declared face, set in that face. */
const typeSection = (): PageComponent =>
  anchoredSection(region('type'), [
    microLabel('$t:admin.ds.found.faces'),
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
    microLabel('$t:admin.ds.found.ladder'),
    ...typeScaleBlock(),
    microLabel('$t:admin.ds.found.emphasis'),
    ...emphasisBlock(),
  ])

/** The one sentence every ladder step is set in. */
const LADDER_SENTENCE = '$t:admin.ds.found.pangram'

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
      microLabel('$t:admin.ds.found.platformLadder'),
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
              note('$t:admin.ds.found.noTypeScale'),
              {
                type: 'link',
                props: {
                  href: TYPE_SCALE_DOC_HREF,
                  className:
                    'text-foreground hover:text-muted-foreground self-start text-sm font-medium',
                },
                content: '$t:admin.ds.found.declareSteps',
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
        children: [note('$t:admin.ds.found.noSpacing')],
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

/**
 * Breakpoints: the one family an author cannot learn from their own config, and
 * the one drawn as a table (the installed `data-table` copy): a threshold has no
 * shape to cast. The wrapper keeps the region's landmark.
 */
const breakpointsBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col', 'data-design-breakpoint-list': 'true' },
    children: [
      ledgerTable({
        props: { 'aria-label': '$t:admin.ds.found.breakpoints' },
        dataSource: tokenRows('breakpoint'),
        columns: [
          { field: 'leaf', label: '$t:admin.ds.found.breakpoint' },
          { field: 'value', label: '$t:admin.ds.found.switchesAt' },
        ],
        emptyMessage: '$t:admin.ds.found.noBreakpoint',
      }),
    ],
  } as PageComponent,
]

/** Shadow: an elevation, cast rather than listed. */
const shadowBlock = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    props: {
      className: 'bg-muted border-border flex flex-wrap gap-6 rounded-lg border p-5',
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
              className: 'bg-card border-border h-16 w-32 rounded-md border',
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
      microLabel('$t:admin.ds.found.duration'),
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
      microLabel('$t:admin.ds.found.easing'),
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
      inPlace('$t:admin.ds.found.cardSample', [
        {
          type: 'container',
          element: 'article',
          props: {
            className: 'border-border bg-card flex flex-col gap-2 rounded-lg border p-4',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground text-md font-medium' },
              content: '$t:admin.ds.found.raised',
            },
          ],
        } as PageComponent,
      ]),
      inPlace('$t:admin.ds.found.subtle', [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border bg-muted flex flex-col gap-2 rounded-lg border p-4',
          },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-foreground text-md font-medium' },
              content: '$t:admin.ds.found.subtle',
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
        '$t:admin.ds.found.primary',
        'text-foreground text-md font-medium',
        '$t:admin.ds.found.primaryDesc'
      ),
      emphasisRow(
        '$t:admin.ds.found.muted',
        'text-muted-foreground text-md',
        '$t:admin.ds.found.mutedDesc'
      ),
      emphasisRow(
        '$t:admin.common.disabled',
        'text-foreground-disabled text-md',
        '$t:admin.ds.found.disabledDesc'
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
    content: '$t:admin.ds.found.notToken',
  } as PageComponent,
  {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      microLabel('$t:admin.ds.found.inert'),
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
      microLabel('$t:admin.ds.found.noDtcg'),
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
      title: '$t:admin.meta.foundations',
      description: '$t:admin.ds.found.blurb',
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
  designSystemDocumentShell(SLUG, TITLE)
)

export default foundations
