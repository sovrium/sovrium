/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// BRAND — the identity this app declared, as opposed to the values it renders
// with.
//
// Foundations owns the token VALUES; this page owns what they are FOR: the
// mark, the roles the colours play, the pictures this app permits, and the
// accent budget each zone may spend.
//
// ─── FOUR ROW SOURCES, AND NOT ONE OF THEM IS JOINED ───────────────────────
//
// The mark's renderings and its geometry come from `/brand`, the declared
// SENTENCES from `/guidance`, the route map from `/zones`, and every empty
// state's gate from `/coverage`. A config page cannot join two arrays, so each
// block binds exactly one — which is why the mark's `alt` rides on the
// rendering row as well as on the geometry row, and why `hasVoiceOverride` is a
// boolean here rather than the override itself.
//
// ─── THE EMPTY STATES ARE GATED ON `coverage`, NOT ON A ROW COUNT ──────────
//
// `visibility.record` has neither a length nor a presence operator, so "this app
// declares no colour roles" is unaskable of a rows binding: zero rows render
// zero rows and there is nothing left to gate. `/coverage?key=` answers exactly
// that question as a ROW — one row carrying `declared` and the `configPath` an
// author would write — so each block binds its own layer and gates the
// disclosure on the row's own boolean. The page record is spent on `/brand`,
// which is the one gate the mark needs and the one no rows source could answer.
//
// ─── A LABEL THAT MUST APPEAR ONCE RIDES ON `index eq 0` ───────────────────
//
// A heading over a rows block cannot sit outside the binding without rendering
// over an empty list, and cannot sit inside it without repeating per row. Every
// guidance row publishes its zero-based `index` within its own kind, so the
// heading is a row child gated on the first one: present exactly when there is
// something to head, and exactly once.

import { withShell } from '../../components/shell'
import {
  DESIGN_BRAND_ENDPOINT,
  DESIGN_COVERAGE_ENDPOINT,
  DESIGN_GUIDANCE_ENDPOINT,
  DESIGN_ZONES_ENDPOINT,
} from '../../system-sources'
import { designSystemBreadcrumb } from './chrome'
import {
  MEASURE_MD,
  MEASURE_SM,
  MEASURE_XS,
  anchoredSection,
  caption,
  microLabel,
  microLabelOf,
  railedConsoleBody,
  notConfiguredCard,
  kitType,
} from './sections'
import type { RailSection } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** This page's own slug and the noun it carries in the trail and the `h1`. */
const SLUG = 'brand'
const TITLE = 'Brand'

/** The page's one-line `meta.description`. */
const DECK = 'The mark, the imagery rules, the colour roles and each zone’s accent budget.'

/** Where an author reads what a `design.*` key does. */
const DOCS_DESIGN = 'https://sovrium.com/en/docs/design'

/**
 * The Voice page, as a LITERAL the mount pass can prefix.
 *
 * A row-supplied href is not mount-prefixed — the prefixing pass runs before row
 * expansion — but this one is the page's own literal, so `/_admin` is prepended
 * for a mounted console and the cross-reference resolves under either root.
 */
const VOICE_PAGE_PATH = '/design-system/voice'

/** The four sections, in reading order — the rail is derived from this list. */
const SECTIONS: readonly RailSection[] = [
  { id: 'design-system-brand-mark', title: 'The mark' },
  { id: 'design-system-brand-color-roles', title: 'Colour roles' },
  { id: 'design-system-brand-imagery', title: 'Imagery' },
  { id: 'design-system-brand-zones', title: 'Zones and accent budget' },
]

/** One family of declared sentences, bound as rows. */
const guidanceRows = (kind: string) => ({
  system: { endpoint: DESIGN_GUIDANCE_ENDPOINT, query: { kind }, rowsKey: 'items', idKey: 'path' },
})

/** Every declared sentence, unfiltered — the binding the verdict columns read. */
const allGuidanceRows = () => ({
  system: { endpoint: DESIGN_GUIDANCE_ENDPOINT, rowsKey: 'items', idKey: 'path' },
})

/** One layer of the coverage ledger, as the single row that answers its gate. */
const coverageRow = (key: string) => ({
  system: { endpoint: DESIGN_COVERAGE_ENDPOINT, query: { key }, rowsKey: 'items', idKey: 'key' },
})

/**
 * The two registers of one declared line.
 *
 * ─── THE SPLIT IS SERVER-SIDE, AND THE REJOIN IS THE INVARIANT ─────────────
 *
 * `/guidance` runs the quote-aware splitter and publishes the instruction a
 * reader obeys and the reason the same line gave for it. A page rendering only
 * the first half drops the operator's own words: `design.colorRoles.signature`
 * declares *"The one accent. Marketing surfaces only, never a state."* and the
 * instruction alone is *"The one accent."* — a rule with its scope removed,
 * which is worse than no rule, because it reads complete.
 *
 * ─── THE TRAILING SPACE IS LOAD-BEARING ────────────────────────────────────
 *
 * The two registers are separate blocks, so `textContent` concatenates them with
 * no separator and the declared line stops being findable on the page as the
 * operator wrote it. A reader searching this page for their own rule has to find
 * it, and `[internal ref]` asserts exactly that.
 *
 * The reason block is emitted UNCONDITIONALLY and renders empty for a one-
 * sentence rule: `visibility.record` carries no presence operator, and an empty
 * paragraph contributes nothing to the row's own text either way.
 */
const registers = (instructionClass: string): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    props: { className: instructionClass },
    content: '$record.instruction ',
  } as PageComponent,
  {
    type: 'text',
    element: 'p',
    props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
    content: '$record.reason',
  } as PageComponent,
]

// ---------------------------------------------------------------------------
// THE MARK
// ---------------------------------------------------------------------------

/**
 * The two states of the mark block, named so a reader knows which they are on.
 *
 * Four links rather than two, because a config page has no conditional
 * attribute: each state is a pair gated on the page record, so exactly one
 * "Your config" and one "Worked example" ever render and exactly one of them
 * carries `aria-current`.
 *
 * Links, never a toggle — [internal ref]'s read-only bound is asserted as the absence
 * of verb-named buttons, and a state a reader can bookmark beats one only their
 * own browser holds.
 */
const markStateLink = (
  target: 'config' | 'example',
  label: string,
  current: boolean
): PageComponent =>
  ({
    type: 'link',
    props: {
      href: `?mark=${target}`,
      className: current
        ? 'text-foreground text-sm font-medium'
        : 'text-foreground-subtle hover:text-foreground text-sm',
      ...(current ? { 'aria-current': 'true' } : {}),
    },
    visibility: { record: { field: 'declared', eq: target === 'config' ? true : false } },
    content: label,
  }) as PageComponent

const markStates = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex items-center gap-3', 'data-testid': 'design-system-mark-states' },
    children: [
      markStateLink('config', 'Your config', true),
      markStateLink('example', 'Your config', false),
      markStateLink('config', 'Worked example', false),
      markStateLink('example', 'Worked example', true),
    ],
  }) as PageComponent

/**
 * One DRAWN rendering of the declared mark.
 *
 * Two whole literal class strings rather than one interpolated: the dark file is
 * drawn on the INVERSE ground, because that is the only ground it is ever seen
 * on, and a runtime-composed class never enters the Tailwind candidate corpus.
 * `ground` is carried on the row rather than derived here, so the pairing stays
 * a fact about the rendering.
 */
const markPanel = (variant: 'light' | 'dark'): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        variant === 'light'
          ? 'border-border bg-background flex flex-col gap-2 rounded-lg border p-4'
          : 'border-border bg-foreground flex flex-col gap-2 rounded-lg border p-4',
    },
    visibility: { record: { field: 'variant', eq: variant } },
    children: [
      microLabelOf(variant === 'light' ? 'src · light' : 'srcDark · dark'),
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'border-border flex h-[140px] items-center justify-center rounded-md border border-dashed p-4',
          'data-design-logo': variant,
        },
        children: [
          {
            type: 'image',
            props: { src: '$record.src', alt: '$record.alt', className: 'max-h-full max-w-full' },
          },
        ],
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle font-mono text-[11px]' },
        content: '$record.configPath',
      },
    ],
  }) as PageComponent

/**
 * One fact of the mark's geometry — always all three rows, never filtered.
 *
 * An app may declare a mark and say nothing about how small it may go, so the
 * honest per-fact answer is a row whose value is absent rather than a missing
 * row: filtering would make "not declared" indistinguishable from "this fact
 * does not exist", and would move the panel's layout under the reader for a
 * reason the page cannot explain.
 */
const FACT_LABELS: readonly (readonly [key: string, label: string])[] = [
  ['alt', 'Accessible name'],
  ['clearSpace', 'Clear space'],
  ['minWidth', 'Smallest reproduction width'],
]

const markFactRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-b py-2 last:border-b-0' },
    children: [
      ...FACT_LABELS.map(
        ([key, label]) =>
          ({
            type: 'text',
            element: 'p',
            props: {
              className:
                'text-foreground-subtle text-[11px] font-medium tracking-[0.04em] uppercase',
            },
            visibility: { record: { field: 'key', eq: key } },
            content: label,
          }) as PageComponent
      ),
      // The declared value, verbatim. `clearSpace` is PROSE by schema — a
      // charter states clear space relative to the mark — so it is printed as
      // the sentence it is and never translated into a measured offset.
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground ${MEASURE_MD} text-md leading-relaxed` },
        visibility: { record: { field: 'declared', eq: true } },
        content: '$record.value',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
        visibility: { record: { field: 'declared', eq: false } },
        content: 'Not declared. Add $record.configPath to record it.',
      },
      // The consequence of the floor, stated rather than left to be inferred.
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
        visibility: { record: { field: 'key', eq: 'minWidth' } },
        content:
          'Below this width the mark stops being legible. Use the icon alone instead of scaling ' +
          'the wordmark further down.',
      },
    ],
  }) as PageComponent

/** What must never be done to the mark, in error ink — the line not to skim. */
const misuseRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1' },
    children: [
      {
        type: 'text',
        element: 'p',
        props: {
          className: 'text-foreground-subtle text-[11px] font-medium tracking-[0.04em] uppercase',
        },
        // The heading rides on the FIRST row: outside the binding it would
        // render over an empty list, inside it ungated it would repeat.
        visibility: { record: { field: 'index', eq: 0 } },
        content: 'Misuse',
      },
      // Error ink on the instruction, because a misuse rule is the one line on
      // this page a reader must not skim past.
      ...registers(`text-error-fg ${MEASURE_MD} text-md leading-relaxed`),
    ],
  }) as PageComponent

/** One do/don't tile of the mark's misuse pair. */
const markExampleTile = (verdict: 'do' | 'dont', note: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        verdict === 'do'
          ? 'border-border flex flex-col gap-2 rounded-md border p-3'
          : 'border-error-border flex flex-col gap-2 rounded-md border p-3',
      'data-design-mark-example': verdict,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            'bg-background-raised border-border flex h-16 items-center justify-center rounded border',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: {
              className:
                verdict === 'do'
                  ? 'text-foreground text-md font-semibold tracking-tight'
                  : 'text-foreground text-md font-semibold tracking-tight italic',
            },
            content: 'Sovrium',
          },
        ],
      },
      {
        type: 'text',
        element: 'span',
        props: {
          className:
            verdict === 'do' ? 'text-foreground-subtle text-[11px]' : 'text-error-fg text-[11px]',
        },
        content: note,
      },
    ],
  }) as PageComponent

/**
 * What a `design.logo` declaration PUBLISHES — the two facts prose cannot carry.
 *
 * Clear space and minimum width are geometry: "leave the height of the mark
 * around it" is obeyed differently by everyone who reads it, and a misuse rule
 * is a picture. So this draws both, plus a do/don't pair, and says outright that
 * it is a demonstration.
 */
const markLockupExample = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-3' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border bg-background-raised flex flex-col gap-2 rounded border p-4',
          'data-testid': 'design-system-mark-lockup',
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'border-border border border-dashed p-4' },
            children: [
              {
                type: 'text',
                element: 'span',
                props: { className: 'text-foreground text-md font-semibold tracking-tight' },
                content: 'Sovrium',
              },
            ],
          },
          {
            type: 'text',
            element: 'span',
            props: {
              className: `text-foreground-subtle ${MEASURE_XS} text-[11px] leading-relaxed`,
            },
            content:
              'The dashed edge is the clear space: declared as clearSpace and kept free of every ' +
              'other element. minWidth 96px is the smallest width the mark may be reproduced at ' +
              'before its counters close up.',
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid gap-3 sm:grid-cols-2' },
        children: [
          markExampleTile('do', 'On its own ground, at or above its minimum width.'),
          markExampleTile('dont', 'Never restyled, re-spaced or set in another face.'),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * THE MARK — or the honest statement that this app declared none.
 *
 * Both states carry `design-system-logo`, deliberately: it is one region
 * answering one question, and an operator who finds nothing under that hook
 * cannot tell "this app declares no mark" from "the panel failed to render".
 */
const markSection = (): PageComponent =>
  anchoredSection(SECTIONS[0] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-4', 'data-testid': 'design-system-logo' },
      children: [
        markStates(),
        // ─── DECLARED ────────────────────────────────────────────────────────
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-4' },
          visibility: { record: { field: 'declared', eq: true } },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'grid gap-4 md:grid-cols-2' },
              dataSource: {
                system: { endpoint: DESIGN_BRAND_ENDPOINT, rowsKey: 'items', idKey: 'configPath' },
              },
              children: [markPanel('light'), markPanel('dark')],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col' },
              dataSource: {
                system: { endpoint: DESIGN_BRAND_ENDPOINT, rowsKey: 'facts', idKey: 'key' },
              },
              children: [markFactRow()],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-1' },
              dataSource: guidanceRows('logo.misuse'),
              children: [misuseRow()],
            },
          ],
        } as PageComponent,
        // ─── NOT DECLARED ────────────────────────────────────────────────────
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-3' },
          visibility: { record: { field: 'declared', eq: false } },
          children: [
            notConfiguredCard({
              body:
                'This app documents no mark, so nothing records its clear space, its smallest ' +
                'reproduction width or the ways it must never be used. The pair below is what a ' +
                'declared one publishes.',
              configKey: 'design.logo',
              href: '/en/docs/design',
            }),
            markLockupExample(),
          ],
        } as PageComponent,
        // The way out to where PLACEMENT is documented. This console documents
        // the DECLARATION; where a mark may appear on a real page is a brand
        // question the published documentation answers.
        {
          type: 'link',
          props: {
            href: DOCS_DESIGN,
            className: 'text-foreground hover:text-foreground-muted self-start text-sm font-medium',
          },
          content: 'How brand placement is declared →',
        } as PageComponent,
      ],
    } as PageComponent,
  ])

// ---------------------------------------------------------------------------
// COLOUR ROLES
// ---------------------------------------------------------------------------

/**
 * One colour role: what it is, what it is painted at, and what it is FOR.
 *
 * The swatch is the public `swatch` kit type fed the role's own name, which is
 * what carries the chip, the resolved hex and the legibility verdict without
 * the page computing any of them. `contrastAgainst` is the declared `pairsWith`
 * rather than the page background, and that pairing is the whole reason the
 * verdict is here: a badge that always measured against the background would
 * print a passing number for the exact pairing a config marks as the one to
 * watch.
 */
const roleRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex items-start gap-3 border-b py-3 last:border-b-0' },
    children: [
      {
        type: 'swatch',
        token: '$record.label',
        contrastAgainst: '$record.pairsWith',
        showHex: true,
        props: {
          className: 'flex shrink-0 items-center gap-2 font-mono text-sm',
          ...kitType('swatch'),
        },
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-1' },
        children: [
          ...registers(`text-foreground ${MEASURE_MD} text-md leading-relaxed`),
          {
            type: 'text',
            element: 'p',
            props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
            visibility: { record: { field: 'pairsWith', neq: '' } },
            content: 'Designed to sit against $record.pairsWith.',
          },
        ],
      },
    ],
  }) as PageComponent

const colorRolesSection = (): PageComponent =>
  anchoredSection(SECTIONS[1] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-3', 'data-testid': 'design-system-color-roles' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col' },
          dataSource: guidanceRows('colorRole'),
          children: [roleRow()],
        } as PageComponent,
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-3' },
          dataSource: coverageRow('color-roles'),
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-3' },
              visibility: { record: { field: 'declared', eq: false } },
              children: [
                notConfiguredCard({
                  body:
                    'This app records nothing about what its colours are FOR, so every role ' +
                    'resolves to the platform’s own and nothing says which ground it was ' +
                    'designed to sit against.',
                  configKey: 'design.colorRoles',
                  href: '/en/docs/design-components',
                }),
              ],
            },
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

// ---------------------------------------------------------------------------
// IMAGERY
// ---------------------------------------------------------------------------

/**
 * One verdict column — the pictures this app asks for, or the ones it refuses.
 *
 * Set ACROSS from each other because that is how a writer reads them and not how
 * the config stores them: `design.imagery` groups by SOURCE (principles,
 * photography, patterns), and a writer deciding whether a screenshot may be
 * tilted needs the refusal beside the preference.
 *
 * The binding is the UNFILTERED guidance list and the split is the row's own
 * `verdict`, which the facet publishes on imagery rows and on nothing else. So
 * one read answers both columns, and a rule's side is the server's classifier
 * rather than a string test this page has no way to run.
 */
const imageryColumn = (verdict: 'prefer' | 'never'): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2', 'data-design-imagery-verdict': verdict },
    children: [
      microLabel(verdict === 'prefer' ? 'Prefer' : 'Never'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-1' },
        dataSource: allGuidanceRows(),
        children: [
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex flex-col gap-0.5' },
            visibility: { record: { field: 'verdict', eq: verdict } },
            children: [
              ...registers(
                verdict === 'prefer'
                  ? `text-foreground ${MEASURE_MD} text-md leading-relaxed`
                  : `text-error-fg ${MEASURE_MD} text-md leading-relaxed`
              ),
            ],
          },
        ],
      },
    ],
  }) as PageComponent

/** One do/don't imagery tile — a rule about pictures, shown as one. */
const imageryTile = (verdict: 'do' | 'dont', frame: string, note: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        verdict === 'do'
          ? 'border-border flex flex-col gap-2 rounded-md border p-3'
          : 'border-error-border flex flex-col gap-2 rounded-md border p-3',
      'data-design-imagery-example': verdict,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          className:
            verdict === 'do'
              ? 'bg-background-subtle flex h-20 items-center justify-center rounded'
              : 'bg-background-subtle border-border flex h-20 items-center justify-center rounded border-4',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle font-mono text-[11px]' },
            content: frame,
          },
        ],
      },
      {
        type: 'text',
        element: 'span',
        props: {
          className:
            verdict === 'do' ? 'text-foreground-subtle text-[11px]' : 'text-error-fg text-[11px]',
        },
        content: note,
      },
    ],
  }) as PageComponent

const imagerySection = (): PageComponent =>
  anchoredSection(SECTIONS[2] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-4', 'data-testid': 'design-system-imagery' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'grid gap-6 md:grid-cols-2' },
          children: [imageryColumn('prefer'), imageryColumn('never')],
        } as PageComponent,
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-3' },
          dataSource: coverageRow('imagery'),
          children: [
            // The visual pair, shown only where there are rules to illustrate:
            // "no device bezels" is a rule ABOUT PICTURES and reads as one only
            // when it is shown, but a demonstration over an undeclared layer
            // would be the console putting imagery rules into an app's mouth.
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-3' },
              visibility: { record: { field: 'declared', eq: true } },
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'grid gap-3 sm:grid-cols-2' },
                  children: [
                    imageryTile(
                      'do',
                      'the running app',
                      'A screenshot of the real thing, on its own ground.'
                    ),
                    imageryTile(
                      'dont',
                      'a device bezel around it',
                      'No mockup frames, no perspective, no device bezels.'
                    ),
                  ],
                } as PageComponent,
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-3' },
              visibility: { record: { field: 'declared', eq: false } },
              children: [
                notConfiguredCard({
                  body:
                    'This app records no rules about pictures, so nothing constrains what a ' +
                    'screenshot or an icon on it may be. Declare principles, photography, ' +
                    'iconSet or patterns to write them down.',
                  configKey: 'design.imagery',
                  href: '/en/docs/design-components',
                }),
              ],
            },
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

// ---------------------------------------------------------------------------
// ZONES AND ACCENT BUDGET
// ---------------------------------------------------------------------------

/** What a budget MEANS — the word alone tells a writer nothing they can spend. */
/** One zone: where it applies, and how much accent it may spend there. */
const zoneRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-b py-3 last:border-b-0' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1' },
        children: [
          // Printed VERBATIM and never parsed: a pattern is not necessarily a
          // glob, and `apps/partner` declares the literal 'everything else'.
          {
            type: 'text',
            element: 'p',
            props: { className: 'text-foreground font-mono text-md font-medium' },
            content: '$record.pattern',
          },
          microLabelOf('$record.zone'),
          {
            type: 'text',
            element: 'span',
            props: {
              className:
                'border-border text-foreground-subtle rounded-full border px-2 py-0.5 text-[11px]',
            },
            content: '$record.accentBudget',
          },
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle text-[11px]' },
            visibility: { record: { field: 'hasVoiceOverride', eq: true } },
            content: 'Departs from the app voice',
          },
        ],
      },
    ],
  }) as PageComponent

const zonesSection = (): PageComponent =>
  anchoredSection(SECTIONS[3] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-3', 'data-testid': 'design-system-zones' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col' },
          dataSource: {
            system: { endpoint: DESIGN_ZONES_ENDPOINT, rowsKey: 'items', idKey: 'pattern' },
          },
          children: [zoneRow()],
        } as PageComponent,
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-2' },
          dataSource: coverageRow('zones'),
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-wrap items-baseline gap-x-2 gap-y-1' },
              visibility: { record: { field: 'declared', eq: true } },
              children: [
                // The sentence has always pointed at Voice; what it never did
                // was GO there. A cross-reference a reader has to navigate by
                // hand is a footnote, and this console is a set of pages whose
                // whole job is leading an operator between them.
                {
                  type: 'link',
                  props: {
                    href: VOICE_PAGE_PATH,
                    className: 'text-foreground hover:text-foreground-muted text-md font-medium',
                  },
                  content: 'Open the Voice page →',
                },
              ],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-2' },
              visibility: { record: { field: 'declared', eq: false } },
              children: [
                caption(
                  'This app declares no zones. Declare design.zones with a route pattern and an ' +
                    "accentBudget of 'public' or 'product' to record how much accent each route " +
                    'family may spend.'
                ),
              ],
            },
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

const brand: PageConfig = withShell(
  {
    id: 'design-system-brand',
    name: 'design-system-brand',
    path: `/design-system/${SLUG}`,
    meta: {
      lang: 'en-US',
      title: TITLE,
      description: DECK,
    },
    // The ONE gate no rows binding can answer: whether this app declares a mark
    // at all. `declared` is the provenance — there is no platform default logo,
    // so it is binary — and `state` is which of the two the page draws.
    dataSource: {
      system: { endpoint: DESIGN_BRAND_ENDPOINT, idKey: 'state' },
    },
    components: railedConsoleBody({
      title: TITLE,
      sections: SECTIONS,
      children: [markSection(), colorRolesSection(), imagerySection(), zonesSection()],
    }),
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
  }
)

export default brand
