/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// VOICE — the half of a design system that tokens cannot carry.
//
// An operator who can see every colour and still does not know that this app
// never uses exclamation marks has not been shown its design system. Every line
// on this page is the operator's own, read from the same document an agent is
// handed.
//
// ─── THE SPLIT IS SERVER-SIDE, AND IT HAS TO BE ────────────────────────────
//
// `design.voice.prefer` is an array of bare strings, and every entry is written
// as an instruction followed by its reason. Separating the two is a quote-aware
// splitter — a naive cut on the first period falls inside
// `…"Sovrium runs the application. On your own infrastructure."` — and a config
// page has no string operations at all. So `/guidance` publishes both halves,
// and this page's only job is to set them in two registers.
//
// The invariant the whole claim rests on is that the two REJOIN to the
// declaration exactly, with one space between them. That is why every rule row
// carries the instruction, the reason, and NOTHING ELSE: an ordinal or a
// repeated label inside the row would break a rejoin that is asserted against
// the row's own text.
//
// ─── THE TRAILING SPACE IS LOAD-BEARING ────────────────────────────────────
//
// The two registers are separate blocks, so `textContent` concatenates them
// with no separator — `…with its verb.A verb tells…` — and the declared line
// stops being findable on the page as the operator wrote it. A reader searching
// this page for their own rule has to find it.
//
// ─── ONE PAGE RECORD, SPENT ON THE ONE GATE THAT NEEDS IT ──────────────────
//
// `visibility.record` has no length operator and no presence operator, so
// "this app declared no tone" is not askable of a rows binding. The page
// therefore binds `?kind=voice.tone` as its RECORD and gates the tone empty
// state on that response's own `total` — the same shape the type page uses for
// `pageCount` beside `routes`. Every other `$record.` on this page sits under a
// `dataSource`, whose children the page-record pass deliberately leaves alone.

import { withShell } from '../../components/shell'
import { DESIGN_GUIDANCE_ENDPOINT, DESIGN_ZONES_ENDPOINT } from '../../system-sources'
import { designSystemBreadcrumb } from './chrome'
import {
  MEASURE_MD,
  MEASURE_SM,
  anchoredSection,
  microLabel,
  microLabelOf,
  railedConsoleBody,
  notConfiguredCard,
} from './sections'
import type { RailSection } from './sections'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** This page's own slug and the noun it carries in the trail and the `h1`. */
const SLUG = 'voice'
const TITLE = 'Voice'

/** The five sections, in reading order — the rail is derived from this list. */
const SECTIONS: readonly RailSection[] = [
  { id: 'voice-principles', title: 'Principles' },
  { id: 'voice-voice', title: 'Voice' },
  { id: 'voice-tone', title: 'Tone by moment' },
  { id: 'voice-in-practice', title: 'In practice' },
  { id: 'voice-zones', title: 'Voice per zone' },
]

/** One family of declared sentences, bound as rows. */
const guidanceRows = (kind: string) => ({
  system: { endpoint: DESIGN_GUIDANCE_ENDPOINT, query: { kind }, rowsKey: 'items', idKey: 'path' },
})

/**
 * The two registers of one declared line.
 *
 * The reason block is emitted UNCONDITIONALLY and renders empty when the line
 * was one sentence: `visibility.record` carries no presence operator, and an
 * empty paragraph contributes nothing to the row's own text, so the rejoin
 * invariant holds either way.
 */
const registers = (): readonly PageComponent[] => [
  {
    type: 'text',
    element: 'p',
    props: {
      className: `text-foreground ${MEASURE_MD} text-md leading-relaxed`,
      'data-design-voice-instruction': 'true',
    },
    content: '$record.instruction ',
  } as PageComponent,
  {
    type: 'text',
    element: 'p',
    props: {
      className: `text-foreground-subtle ${MEASURE_SM} text-sm leading-relaxed`,
      'data-design-voice-reason': 'true',
    },
    content: '$record.reason',
  } as PageComponent,
]

/** One writing rule, set against its own reason. */
const ruleRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex flex-col gap-0.5 border-b py-2 last:border-b-0',
      'data-design-voice-rule': 'true',
    },
    children: registers(),
  }) as PageComponent

/**
 * One verdict column — the rules this app prefers, or the ones it avoids.
 *
 * Set ACROSS from each other, because that is how a writer reads them and not
 * how the config stores them: a writer deciding whether a sentence is allowed
 * needs the refusal beside the preference, and two stacked lists make them hunt.
 */
const verdictColumn = (verdict: 'prefer' | 'avoid'): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1.5', 'data-design-voice-verdict': verdict },
    children: [
      microLabel(verdict === 'prefer' ? 'Prefer' : 'Avoid'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col' },
        dataSource: guidanceRows(`voice.${verdict}`),
        children: [ruleRow()],
      },
    ],
  }) as PageComponent

/** A labelled prose row: the subject, then the line that governs it. */
const labelledRows = (label: string, kind: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-b py-2 last:border-b-0' },
    children: [
      microLabel(label),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex flex-col gap-1' },
        dataSource: guidanceRows(kind),
        children: [
          {
            type: 'text',
            element: 'p',
            props: { className: `text-foreground ${MEASURE_MD} text-md leading-relaxed` },
            content: '$record.instruction',
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * PRINCIPLES — the declared convictions, in the order the author ranked them.
 *
 * `design.principles` is an ORDERED array and the order is the author's
 * ranking, which an unnumbered list throws away: a reader cannot tell a ranked
 * list from an unordered one, and cannot cite "the second principle" in a
 * review without counting. The ordinal is PUBLISHED rather than derived — a
 * config page can neither add one to an index nor pad the result.
 */
const principlesSection = (): PageComponent =>
  anchoredSection(SECTIONS[0] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col' },
      dataSource: guidanceRows('principle'),
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border flex items-baseline gap-3 border-b py-2 last:border-b-0',
            'data-design-principle': '$record.index',
          },
          children: [
            {
              type: 'text',
              element: 'span',
              props: {
                className: 'text-foreground-subtle w-6 shrink-0 font-mono text-[11px]',
                'data-design-principle-ordinal': 'true',
              },
              content: '$record.ordinal',
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex min-w-0 flex-1 flex-col gap-0.5' },
              children: registers(),
            },
          ],
        },
      ],
    } as PageComponent,
  ])

/** VOICE — how the app addresses a reader, and what it refuses to say. */
const voiceSection = (): PageComponent =>
  anchoredSection(SECTIONS[1] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col' },
      children: [
        labelledRows('Address the reader as', 'voice.pronoun'),
        labelledRows('Personality', 'voice.personality'),
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border grid gap-6 border-b py-2 last:border-b-0 md:grid-cols-2',
          },
          children: [verdictColumn('prefer'), verdictColumn('avoid')],
        },
      ],
    } as PageComponent,
  ])

/**
 * The role each moment is painted in, so the state DEMONSTRATES the rule it
 * states rather than merely asserting it.
 *
 * A voice section that says "error is loud" in prose set at exactly the weight
 * and colour of every other sentence on the page has demonstrated nothing.
 *
 * Six gated bars and a `notIn` fallback, rather than one bar whose class is
 * read from the row: a class name is not a value a row carries, and a moment
 * this map does not name falls back to the neutral border role — a state with
 * no consequence attached, which is the honest default.
 */
const MOMENT_ACCENT: readonly (readonly [moment: string, className: string])[] = [
  ['error', 'bg-error-solid'],
  ['destructive', 'bg-error-solid'],
  ['warning', 'bg-warning-solid'],
  ['success', 'bg-success-solid'],
  ['info', 'bg-info-solid'],
  ['empty', 'bg-background-subtle'],
]

/** Every accented bar, one of which renders. */
const accentBars = (): readonly PageComponent[] => [
  ...MOMENT_ACCENT.map(
    ([moment, className]) =>
      ({
        type: 'container',
        element: 'div',
        props: { className: `${className} w-1.5 shrink-0 rounded-full` },
        visibility: { record: { field: 'label', eq: moment } },
        children: [],
      }) as PageComponent
  ),
  {
    type: 'container',
    element: 'div',
    props: { className: 'bg-border w-1.5 shrink-0 rounded-full' },
    visibility: { record: { field: 'label', notIn: MOMENT_ACCENT.map(([moment]) => moment) } },
    children: [],
  } as PageComponent,
]

/** The moment's name over the rule that governs it. */
const stateBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-col gap-1' },
    children: [microLabelOf('$record.label'), ...registers()],
  }) as PageComponent

/**
 * One moment, rendered as the STATE it governs.
 *
 * TWO templates rather than one, because `loading` additionally carries
 * `role="status"` and `aria-busy` — a loading moment that announces itself to
 * no assistive technology is a sentence about loading rather than a specimen of
 * it, and this section is where an operator comes to see what "loading" looks
 * AND sounds like in this app. A config page has no conditional attribute, so
 * the branch is two gated siblings.
 */
const momentState = (loading: boolean): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex items-stretch gap-3 rounded-md border p-3',
      'data-testid': 'design-system-state-$record.label',
      ...(loading ? { role: 'status', 'aria-busy': 'true' } : {}),
    },
    visibility: {
      record: { field: 'label', ...(loading ? { eq: 'loading' } : { neq: 'loading' }) },
    },
    children: [...accentBars(), stateBody()],
  }) as PageComponent

/** TONE — every declared moment, as a live state carrying its own rule. */
const toneSection = (): PageComponent =>
  anchoredSection(SECTIONS[2] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-3', 'data-testid': 'design-system-tone' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-3' },
          dataSource: guidanceRows('voice.tone'),
          children: [momentState(true), momentState(false)],
        },
        // The empty half, gated on the PAGE RECORD — the one gate on this page
        // that needs a scalar no rows binding can answer.
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-3' },
          visibility: { record: { field: 'total', eq: 0 } },
          children: [
            notConfiguredCard({
              body:
                'This app declares no tone overrides, so every moment \u2014 empty, loading, ' +
                'error, success, destructive \u2014 speaks in the voice above. Declare a tone to ' +
                'set a register per moment.',
              configKey: 'design.voice.tone',
              href: '/en/docs/design',
            }),
          ],
        },
      ],
    } as PageComponent,
  ])

/**
 * IN PRACTICE — the one block on this page that is Sovrium's own words.
 *
 * Every rule above is an instruction, and the one thing instructions cannot do
 * is show the difference they describe. There is NO config key behind this
 * pair, which is exactly why it carries the worked-example label: read as the
 * operator's, it would be the console putting copy into their mouth.
 */
const practiceRow = (verdict: 'fact' | 'claim', label: string, line: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1', 'data-design-practice': verdict },
    children: [
      microLabel(label),
      {
        type: 'text',
        element: 'p',
        props: {
          className:
            verdict === 'fact'
              ? `text-foreground ${MEASURE_MD} text-md leading-relaxed`
              : `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed line-through`,
        },
        content: line,
      },
    ],
  }) as PageComponent

const inPracticeSection = (): PageComponent =>
  anchoredSection(SECTIONS[3] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-3', 'data-testid': 'design-system-in-practice' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'grid gap-4 sm:grid-cols-2' },
          children: [
            practiceRow(
              'fact',
              'Reads as a fact',
              'Sovrium runs the application. On your own infrastructure.'
            ),
            practiceRow(
              'claim',
              'Reads as a claim',
              'Sovrium is the most powerful configuration platform available today.'
            ),
          ],
        } as PageComponent,
      ],
    } as PageComponent,
  ])

/**
 * What a budget MEANS, stated once — the field is `public`/`product` and the
 * word alone tells a writer nothing about what they may spend.
 */
const budgetNote = (budget: 'public' | 'product', body: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'max-w-2xl' },
    visibility: { record: { field: 'accentBudget', eq: budget } },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: `text-foreground-subtle ${MEASURE_MD} text-md leading-relaxed` },
        content: body,
      },
    ],
  }) as PageComponent

/**
 * ZONES — which route family reads in which register, and where it departs.
 *
 * A one-register app has no zone map and renders an empty list here. A
 * two-register app has one, and without this block its second register was
 * undiscoverable from the console: `design.voice` alone described `/portal/*`
 * as addressing the reader the way the marketing pages do, which is precisely
 * the *confident and wrong* class — worse than saying nothing, because a writer
 * would act on it.
 *
 * ─── THE OVERRIDES ARE ROWS OF THEIR OWN, AND THAT IS THE CONTRACT ─────────
 *
 * `/zones` publishes `hasVoiceOverride` as a boolean rather than the override
 * itself, because the sentences are already rows on the guidance facet under
 * `zone.voice.*` and publishing them twice would let the two drift. So the map
 * lists the patterns and the override sentences follow it, each labelled with
 * the zone it governs.
 *
 * ─── INHERITANCE IS SHOWN NOW, NOT STATED ─────────────────────────────────
 *
 * A sentence used to say it — "everything this zone does not name is inherited
 * from the app voice above" — and X2 deleted it, along with every other
 * paragraph on this console that explained a panel instead of being one.
 *
 * Nothing was lost, because the panel already demonstrates it: all four voice
 * fields are drawn as labelled groups, and the ones a zone does not override
 * are drawn EMPTY. That is the reading a writer must not reach — whole-object
 * replacement, a zone whose only rules are the ones it named — ruled out by
 * what renders rather than by a claim about it. An overridden field would then
 * be absent, not blank.
 *
 * ─── AND `inherited` IS PUBLISHED BUT NOT READ ────────────────────────────
 *
 * This block used to assert that "`/zones` publishes no such list". It does:
 * every row carries `inherited: [{ name }]` and `inheritedCount`
 * (`domain/models/api/admin/design-system/facets-zones.ts:73`), filled by
 * `application/use-cases/admin/design-system-brand-facet.ts`. This page reads
 * neither. `inheritedCount` is a scalar and could be drawn as data today; the
 * NAMES are an array nested inside a row, and a rows binding reads an endpoint
 * rather than a field, so drawing those needs platform work.
 */
const zonesSection = (): PageComponent =>
  anchoredSection(SECTIONS[4] as RailSection, [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col', 'data-testid': 'design-system-zones' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col' },
          dataSource: {
            system: { endpoint: DESIGN_ZONES_ENDPOINT, rowsKey: 'items', idKey: 'pattern' },
          },
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border flex flex-col gap-2 border-b py-3 last:border-b-0',
              },
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-wrap items-baseline gap-x-3 gap-y-1' },
                  children: [
                    {
                      type: 'text',
                      element: 'p',
                      props: { className: 'text-foreground font-mono text-md font-medium' },
                      content: '$record.pattern',
                    },
                    microLabelOf('$record.zone'),
                  ],
                },
                budgetNote(
                  'public',
                  'Public accent budget: the persuasion budget — warmth, accent, marketing ' +
                    'weight. It may only govern ungated routes.'
                ),
                budgetNote(
                  'product',
                  'Product accent budget: the working register, for everything a signed-in ' +
                    'operator sees.'
                ),
              ],
            },
          ],
        } as PageComponent,
        labelledRows('Zone addresses the reader as', 'zone.voice.pronoun'),
        labelledRows('Zone prefers', 'zone.voice.prefer'),
        labelledRows('Zone avoids', 'zone.voice.avoid'),
        labelledRows('Zone tone', 'zone.voice.tone'),
      ],
    } as PageComponent,
  ])

const voice: PageConfig = withShell(
  {
    id: 'design-system-voice',
    name: 'design-system-voice',
    path: `/design-system/${SLUG}`,
    // The deck is the page's own sentence and runs past the 160-character
    // bound a `meta.description` carries, so the head gets the short form and
    // the reader gets the long one.
    meta: {
      lang: 'en-US',
      title: TITLE,
      description:
        'The rules a writer follows here: what this app believes, how it addresses a reader, and what it refuses to say.',
    },
    // The ONE scalar no rows binding can answer: how many tone moments this app
    // declared. Every other `$record.` on this page sits under a `dataSource`,
    // whose children the page-record pass leaves unsubstituted by design.
    dataSource: {
      system: { endpoint: DESIGN_GUIDANCE_ENDPOINT, query: { kind: 'voice.tone' }, idKey: 'total' },
    },
    components: railedConsoleBody({
      title: TITLE,
      sections: SECTIONS,
      children: [
        principlesSection(),
        voiceSection(),
        toneSection(),
        inPracticeSection(),
        zonesSection(),
      ],
    }),
  },
  {
    breadcrumb: designSystemBreadcrumb(SLUG, TITLE),
  }
)

export default voice
