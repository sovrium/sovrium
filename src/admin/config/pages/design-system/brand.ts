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
// zone each route family belongs to.
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

import { ledgerTable } from '../../components/data-table-blocks'
import { sentence } from '../../components/sentence'
import { withShell } from '../../components/shell'
import {
  DESIGN_BRAND_ENDPOINT,
  DESIGN_COVERAGE_ENDPOINT,
  DESIGN_GUIDANCE_ENDPOINT,
  DESIGN_ZONES_ENDPOINT,
} from '../../system-sources'
import { designSystemDocumentShell } from './chrome'
import {
  MEASURE_MD,
  MEASURE_SM,
  MEASURE_XS,
  anchoredSection,
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
const TITLE = '$t:admin.common.brand'

/** The page's one-line `meta.description`. */
const DECK = '$t:admin.ds.brand.blurb'

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
  { id: 'design-system-brand-mark', title: '$t:admin.ds.brand.mark' },
  { id: 'design-system-brand-color-roles', title: '$t:admin.ds.brand.colourRoles' },
  { id: 'design-system-brand-imagery', title: '$t:admin.ds.brand.imagery' },
  { id: 'design-system-brand-zones', title: '$t:admin.common.zones' },
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
      markStateLink('config', '$t:admin.ds.brand.yourConfig', true),
      markStateLink('example', '$t:admin.ds.brand.yourConfig', false),
      markStateLink('config', '$t:admin.ds.brand.example', false),
      markStateLink('example', '$t:admin.ds.brand.example', true),
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
          className: 'flex h-[140px] items-center justify-center p-4',
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
  ['alt', '$t:admin.ds.brand.accessibleName'],
  ['clearSpace', '$t:admin.ds.brand.clearSpace'],
  ['minWidth', '$t:admin.ds.brand.minWidth'],
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
      sentence(
        `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed`,
        [
          '$t:admin.ds.brand.notDeclared',
          ' ',
          '$record.configPath',
          ' ',
          '$t:admin.ds.brand.toRecordIt',
        ],
        { visibility: { record: { field: 'declared', eq: false } } }
      ),
      // The consequence of the floor, stated rather than left to be inferred.
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed` },
        visibility: { record: { field: 'key', eq: 'minWidth' } },
        content: '$t:admin.ds.brand.minWidthHint',
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
        content: '$t:admin.ds.brand.misuse',
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
          className: 'bg-card border-border flex h-16 items-center justify-center rounded border',
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
            content: '$app.label',
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
          className: 'border-border bg-card flex flex-col gap-2 rounded border p-4',
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
                content: '$app.label',
              },
            ],
          },
          {
            type: 'text',
            element: 'span',
            props: {
              className: `text-foreground-subtle ${MEASURE_XS} text-[11px] leading-relaxed`,
            },
            content: '$t:admin.ds.brand.clearSpaceNote',
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid gap-3 sm:grid-cols-2' },
        children: [
          markExampleTile('do', '$t:admin.ds.brand.ownGround'),
          markExampleTile('dont', '$t:admin.ds.brand.never'),
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
              body: '$t:admin.ds.brand.noMark',
              configKey: 'design.logo',
              href: DOCS_DESIGN,
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
            className: 'text-foreground hover:text-muted-foreground self-start text-sm font-medium',
          },
          content: '$t:admin.ds.brand.howPlacement',
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
 * The swatch is the public `swatch` kit type fed the role's own name: it draws
 * the chip, the resolved hex and the legibility verdict. `contrastAgainst` is
 * the declared `pairsWith`, not the page background — a badge measured against
 * the background would pass the exact pairing a config marks as the one to
 * watch. A fixed two-column grid puts every description at the same x.
 */
const ROLE_ROW_CLASS =
  'border-border grid grid-cols-1 items-start gap-3 border-b py-3 last:border-b-0 sm:grid-cols-[17rem_minmax(0,1fr)]'

const roleRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: ROLE_ROW_CLASS },
    children: [
      {
        type: 'swatch',
        token: '$record.label',
        contrastAgainst: '$record.pairsWith',
        showHex: true,
        props: {
          className: 'flex min-w-0 flex-wrap items-center gap-2 font-mono text-sm',
          ...kitType('swatch'),
        },
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-1' },
        children: [
          ...registers(`text-foreground ${MEASURE_MD} text-md leading-relaxed`),
          sentence(
            `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed`,
            ['$t:admin.ds.brand.pairsWith', ' ', '$record.pairsWith', '.'],
            { visibility: { record: { field: 'pairsWith', isNotEmpty: true } } }
          ),
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
                  body: '$t:admin.ds.brand.noColourRoles',
                  configKey: 'design.colorRoles',
                  href: `${DOCS_DESIGN}-components`,
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
      microLabel(verdict === 'prefer' ? '$t:admin.common.prefer' : '$t:admin.ds.brand.neverLabel'),
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
              ? 'bg-muted flex h-20 items-center justify-center rounded'
              : 'bg-muted border-border flex h-20 items-center justify-center rounded border-4',
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
                      '$t:admin.ds.brand.runningApp',
                      '$t:admin.ds.brand.imageryDo'
                    ),
                    imageryTile('dont', '$t:admin.ds.brand.bezel', '$t:admin.ds.brand.imageryDont'),
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
                  body: '$t:admin.ds.brand.noImagery',
                  configKey: 'design.imagery',
                  href: `${DOCS_DESIGN}-components`,
                }),
              ],
            },
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

// ─── ZONES ─────────────────────────────────────────────────────────────────────

/**
 * The zone map, one row per route pattern: the pattern, the zone it reads in,
 * and whether that zone's voice departs from the app's.
 *
 * The pattern is printed VERBATIM and never parsed: a pattern is not
 * necessarily a glob, and an app may declare the literal 'everything else'.
 */
const zonesLedger = (): PageComponent =>
  ledgerTable({
    props: { 'aria-label': '$t:admin.common.zones' },
    dataSource: {
      system: { endpoint: DESIGN_ZONES_ENDPOINT, rowsKey: 'items', idKey: 'pattern' },
    },
    columns: [
      { field: 'pattern', label: '$t:admin.common.routePattern' },
      { field: 'zone', label: '$t:admin.common.zone' },
      {
        field: 'hasVoiceOverride',
        label: '$t:admin.common.voice',
        valueLabels: {
          true: '$t:admin.ds.brand.zoneOverride',
          false: '$t:admin.ds.brand.appVoice',
        },
      },
    ],
    // The empty ledger is the not-declared state, so it carries the next step.
    emptyMessage: '$t:admin.ds.brand.noZones',
  })

const zonesSection = (): PageComponent =>
  anchoredSection(SECTIONS[3] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-3', 'data-testid': 'design-system-zones' },
      children: [
        zonesLedger(),
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
                // A cross-reference a reader must navigate by hand is a
                // footnote; this one goes there, when the Voice page exists.
                {
                  type: 'link',
                  visibility: { declares: 'design.voice' },
                  props: {
                    href: VOICE_PAGE_PATH,
                    className: 'text-foreground hover:text-muted-foreground text-md font-medium',
                  },
                  content: '$t:admin.ds.brand.openVoice',
                },
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
    requires: ['design.brand'],
    meta: {
      title: '$t:admin.meta.brand',
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
  designSystemDocumentShell(SLUG, TITLE)
)

export default brand
