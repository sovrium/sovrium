/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three v1 design-system specimen sections, as config component trees.
 *
 * ─── THESE ARE REAL SOVRIUM PAGES, WHICH IS THE WHOLE POINT ─────────────────
 *
 * A design-system page that mocks its own specimens documents the mock. These
 * sections are composed from the SAME component-types an operator writes —
 * `container`, `text`, `card`, `divider` — and rendered by the SAME renderer, so
 * a swatch showing `bg-background` shows what `bg-background` actually paints in
 * this app. **Zero new component primitives** ([internal ref] Rule #1): if a specimen
 * cannot be expressed in the existing catalogue, the catalogue is the thing to
 * fix, not this file.
 *
 * ─── EVERY VALUE COMES FROM `buildDesignSystem`, NOT FROM A SECOND READ ─────
 *
 * The sections project the SAME document the JSON and markdown exports project.
 * A preview that re-derived the palette from `app.theme` could drift from what
 * `/api/admin/design-system.json` reports, and the operator would have two
 * answers to one question with no way to tell which is running.
 *
 * ─── THE CONFIDENTIALITY BOUND ──────────────────────────────────────────────
 *
 * Nothing here reads `app.tables`, `app.env`, or a record. A design system
 * describes how an app LOOKS; a specimen table populated from real rows would
 * turn a documentation surface into an unaudited data viewer ([internal ref] A2).
 */

import { SOVRIUM_EXTENSION_KEY } from '@/domain/models/api/admin/design-system'
import {
  box,
  caption,
  card,
  microLabel,
  rule,
  sectionHeading,
  text,
} from './design-system-specimen-primitives'
import type {
  DesignSystemDocument,
  SovriumDesignExtension,
} from '@/domain/models/api/admin/design-system'
import type { Component } from '@/domain/models/app/pages/components'

/** A labelled prose row: the moment, then the rule that governs it. */
const guidanceRow = (label: string, rule_: string): Component =>
  box('border-border flex flex-col gap-1 border-b py-2 last:border-b-0', [
    microLabel(label),
    text('p', 'text-foreground text-sm leading-relaxed', rule_),
  ])

/**
 * One label over MANY rules — the shape `prefer` and `avoid` actually have.
 *
 * Rendering each line through {@link guidanceRow} stamped its label once per
 * line: `apps/partner` alone printed PREFER ten times and AVOID five, and after
 * the first the word carries nothing a reader did not already know. That is the
 * redundant label [internal ref] D4 names outright. The label is stated once and the
 * rules stack under it, which is also what lets the eye read them as one set
 * rather than as fifteen unrelated rows.
 */
const guidanceRules = (label: string, lines: readonly string[]): readonly Component[] =>
  lines.length === 0
    ? []
    : [
        box('border-border flex flex-col gap-1.5 border-b py-2 last:border-b-0', [
          microLabel(label),
          ...lines.map((line) => text('p', 'text-foreground text-sm leading-relaxed', line)),
        ]),
      ]

/** A titled block, or nothing when it has no rows. */
const guidanceBlock = (
  title: string,
  rows: readonly Component[],
  testId?: string
): readonly Component[] =>
  rows.length === 0 ? [] : [rule(), sectionHeading(title), box('flex flex-col', rows, testId)]

/** The declared convictions, in the order the author ranked them. */
const principlesBlock = (principles: readonly string[]): readonly Component[] =>
  principles.length === 0
    ? []
    : [
        sectionHeading('Principles'),
        box(
          'flex flex-col gap-2',
          principles.map((principle) =>
            text('p', 'text-foreground text-sm leading-relaxed', principle)
          )
        ),
      ]

/** How the app addresses a reader, and what it refuses to say. */
const voiceBlock = (
  voice: Readonly<NonNullable<SovriumDesignExtension['voice']>> | undefined
): readonly Component[] =>
  voice === undefined
    ? []
    : guidanceBlock('Voice', [
        ...(voice.pronoun === undefined
          ? []
          : [guidanceRow('Address the reader as', voice.pronoun)]),
        ...(voice.personality?.length
          ? [guidanceRow('Personality', voice.personality.join(', '))]
          : []),
        ...guidanceRules('Prefer', voice.prefer ?? []),
        ...guidanceRules('Avoid', voice.avoid ?? []),
      ])

/**
 * The role each moment is painted in, so the state demonstrates the rule it
 * states rather than merely asserting it.
 *
 * A voice section that says "error is loud" in prose set at exactly the weight
 * and colour of every other sentence on the page has demonstrated nothing. Any
 * moment the app names but this map does not falls back to the neutral border
 * role — a state with no consequence attached, which is the honest default.
 */
const MOMENT_ACCENT: Readonly<Record<string, string>> = {
  error: 'bg-error-solid',
  destructive: 'bg-error-solid',
  warning: 'bg-warning-solid',
  success: 'bg-success-solid',
  info: 'bg-info-solid',
  empty: 'bg-background-subtle',
}

/**
 * One moment, rendered as the STATE it governs.
 *
 * `loading` additionally carries `role="status"` and `aria-busy`, because a
 * loading moment that announces itself to no assistive technology is a sentence
 * about loading rather than a specimen of it — and this section is where an
 * operator comes to see what "loading" looks AND sounds like in this app.
 */
const momentState = (moment: string, line: string): Component =>
  box(
    'border-border flex items-stretch gap-3 rounded-md border p-3',
    [
      box(`${MOMENT_ACCENT[moment] ?? 'bg-border'} w-1.5 shrink-0 rounded-full`, []),
      box('flex flex-col gap-1', [
        microLabel(moment),
        text('p', 'text-foreground text-sm leading-relaxed', line),
      ]),
    ],
    `design-system-state-${moment}`,
    moment === 'loading' ? { role: 'status', 'aria-busy': 'true' } : undefined
  )

/** Every declared moment, as a live state carrying the rule that governs it. */
const toneBlock = (tone: Readonly<Record<string, string | undefined>>): readonly Component[] => {
  const states = Object.entries(tone).flatMap(([moment, line]) =>
    line === undefined ? [] : [momentState(moment, line)]
  )
  return states.length === 0
    ? []
    : [
        rule(),
        sectionHeading('Tone by moment'),
        box('flex flex-col gap-3', states, 'design-system-tone'),
      ]
}

/** What each colour is FOR — the half a swatch cannot carry. */
const rolesBlock = (
  roles: Readonly<NonNullable<SovriumDesignExtension['colorRoles']>>
): readonly Component[] =>
  guidanceBlock(
    'Colour roles',
    Object.entries(roles).map(([name, role]) =>
      guidanceRow(
        name,
        [role.usage, role.pairsWith === undefined ? undefined : `Pairs with ${role.pairsWith}.`]
          .filter((part) => part !== undefined)
          .join(' ')
      )
    ),
    'design-system-color-roles'
  )

/**
 * One field of a component entry, labelled by the field it came from.
 *
 * The label names the FIELD rather than paraphrasing it, because the value is
 * the author's own sentence and a lead-in written here would collide with it:
 * `apps/partner` writes its `dont` as "Do not grow it into a template…", which
 * any prefix meaning "never" turns into a double negative. Naming the field is
 * the one lead-in that cannot fight the sentence under it.
 */
const componentField = (label: string, value: string | undefined): readonly Component[] =>
  value === undefined
    ? []
    : [
        box('flex flex-col gap-1', [
          microLabel(label),
          text('p', 'text-foreground text-sm leading-relaxed', value),
        ]),
      ]

/**
 * What each reusable component is for, when to reach for it, and when not to.
 *
 * The three fields are kept APART. Joining them with a space ran a description,
 * a condition and a prohibition together as one paragraph, so the sentence a
 * reader most needs to obey — the `dont` — arrived as the tail of a paragraph
 * that opened by explaining what the component was good for. Three fields the
 * schema kept distinct should not be flattened by the surface that renders them.
 */
const componentsBlock = (
  components: Readonly<NonNullable<SovriumDesignExtension['components']>>
): readonly Component[] =>
  guidanceBlock(
    'Components',
    Object.entries(components).map(([name, entry]) =>
      box('border-border flex flex-col gap-2 border-b py-3 last:border-b-0', [
        text('p', 'text-foreground font-mono text-sm font-medium', name),
        ...componentField('Usage', entry.usage),
        ...componentField('When', entry.when),
        ...componentField('Don’t', entry.dont),
      ])
    )
  )

/**
 * What images are FOR in this app, and which ones it refuses to use.
 *
 * `design.imagery` reached the DTCG document and the markdown charter long
 * before it reached this page, which is exactly how it went unnoticed: an
 * operator reading the console saw a panel claiming the app declared nothing
 * while `/api/admin/design-system.md` printed the icon set on the same config.
 *
 * `iconSet` is a single value and gets a single row; the other three are lists
 * and stack under one label each — the same reason `prefer` and `avoid` do,
 * D4.
 */
const imageryBlock = (
  imagery: Readonly<NonNullable<SovriumDesignExtension['imagery']>> | undefined
): readonly Component[] =>
  guidanceBlock(
    'Imagery',
    [
      ...(imagery?.iconSet === undefined ? [] : [guidanceRow('Icon set', imagery.iconSet)]),
      ...guidanceRules('Principles', imagery?.principles ?? []),
      ...guidanceRules('Photography', imagery?.photography ?? []),
      ...guidanceRules('Patterns', imagery?.patterns ?? []),
    ],
    'design-system-imagery'
  )

/**
 * `a, b and c` — a sentence, not a config dump.
 *
 * Sits above its two callers rather than beside the empty state it was written
 * for: {@link zonesBlock} names the inherited fields with it, and the same
 * comma-and-`and` rendering in both is what makes "inherits pronoun and avoid"
 * read like the empty state's own prose.
 */
const andList = (parts: readonly string[]): string =>
  parts.length < 2
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

/**
 * One zone of the map, as the extension publishes it.
 *
 * `Readonly` because the contract type is Zod-inferred and therefore mutable,
 * and nothing on this page may write back into the document it renders — the
 * same wrapping `imageryBlock` and `rolesBlock` apply to their own slices.
 */
type DesignZone = Readonly<NonNullable<SovriumDesignExtension['zones']>[number]>

/** The base voice a zone departs from. */
type BaseVoice = Readonly<NonNullable<SovriumDesignExtension['voice']>> | undefined

/**
 * What a budget MEANS, stated once — the field is `public`/`product` and the
 * word alone tells a writer nothing about what they may spend.
 */
const BUDGET_NOTE: Readonly<Record<string, string>> = {
  public:
    'Public accent budget: the persuasion budget — warmth, accent, marketing weight. It may only govern ungated routes.',
  product: 'Product accent budget: the working register, for everything a signed-in operator sees.',
}

/**
 * The whole override surface, in schema order.
 *
 * `personality` is deliberately not here, mirroring `ZoneVoiceOverrideSchema`:
 * it is app IDENTITY, not situational register, so it can neither be overridden
 * nor inherited — it simply governs everywhere.
 */
const OVERRIDABLE_VOICE_FIELDS = ['pronoun', 'prefer', 'avoid', 'tone'] as const

/** Whether a voice field carries anything — an empty list states no rule. */
const declares = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length > 0
    : typeof value === 'object' && value !== null
      ? Object.values(value).some((entry) => entry !== undefined)
      : value !== undefined

/** The fields this zone REPLACES, rendered as the rules they now are. */
const overrideRows = (voice: Readonly<NonNullable<DesignZone['voice']>>): readonly Component[] => [
  ...(voice.pronoun === undefined ? [] : [guidanceRow('Address the reader as', voice.pronoun)]),
  ...guidanceRules('Prefer', voice.prefer ?? []),
  ...guidanceRules('Avoid', voice.avoid ?? []),
  ...Object.entries(voice.tone ?? {}).flatMap(([moment, line]) =>
    line === undefined ? [] : [guidanceRow(moment, line)]
  ),
]

/**
 * WHICH fields still come from the app voice — the assertion that makes this
 * per-FIELD rather than whole-object.
 *
 * It names the FIELDS and never restates their lines. Restating them would
 * present an inherited rule as this zone's own, so an author who later edits
 * `design.voice.prefer` would read a page saying the zone has a `prefer` of its
 * own and leave the edit unmade. Saying nothing at all is the opposite error:
 * a reader would take the two fields the zone overrode to be its entire voice,
 * which IS whole-object replacement — the reading that silently drops `avoid`,
 * where the destructive guidance lives.
 *
 * Computed against what the BASE actually declares, not against the four field
 * names: a zone cannot inherit a `tone` from an app that never wrote one, and
 * claiming it does is a rule a writer would go looking for and not find.
 */
const inheritedFields = (zone: DesignZone, base: BaseVoice): readonly string[] =>
  base === undefined
    ? []
    : OVERRIDABLE_VOICE_FIELDS.filter(
        (field) => declares(base[field]) && !declares(zone.voice?.[field])
      )

/** One zone: where it applies, what it may spend, and how its voice departs. */
const zoneEntry = (zone: DesignZone, base: BaseVoice): Component => {
  const inherited = inheritedFields(zone, base)
  return box('border-border flex flex-col gap-2 border-b py-3 last:border-b-0', [
    box('flex flex-wrap items-baseline gap-x-3 gap-y-1', [
      text('p', 'text-foreground font-mono text-sm font-medium', zone.pattern),
      microLabel(zone.zone),
    ]),
    ...(zone.accentBudget === undefined || BUDGET_NOTE[zone.accentBudget] === undefined
      ? []
      : [caption(BUDGET_NOTE[zone.accentBudget] as string)]),
    ...(zone.voice === undefined ? [] : overrideRows(zone.voice)),
    ...(inherited.length === 0
      ? []
      : [caption(`Inherits ${andList([...inherited])} from the app voice.`)]),
  ])
}

/**
 * ZONES — which route family reads in which register, and where it departs.
 *
 * A one-register app has no zone map and renders nothing here. A two-register
 * app has one, and without this block its second register was undiscoverable
 * from the console: `design.voice` alone described `/portal/*` as addressing
 * the reader the way the marketing pages do, which is precisely the *confident
 * and wrong* class — worse than saying nothing, because a writer would act on
 * it.
 *
 * The zone map renders even when no entry overrides a voice. It is guidance in
 * its own right — a writer facing a page still needs to know which family it
 * belongs to and what accent that family may spend — and an app declaring only
 * `design.zones` must not be told it declared nothing.
 */
const zonesBlock = (zones: readonly DesignZone[], base: BaseVoice): readonly Component[] =>
  guidanceBlock(
    'Zones',
    zones.map((zone) => zoneEntry(zone, base)),
    'design-system-zones'
  )

/**
 * Every guidance key this panel renders — the ONE list emptiness is read from.
 *
 * This registry exists because a hand-written conjunction has now been wrong
 * twice. It first named `design.voice` alone; `components` was added after an
 * app declaring only component rules was told it "declares no usage rules yet"
 * directly above a populated Components block; and `imagery` reproduced the
 * identical defect the moment an app declared it. `design.zones` is already
 * planned, and under a conjunction would have been the third.
 *
 * The fix is not a longer conjunction — it is deleting the conjunction. Adding
 * a key here adds it to the render order, to the emptiness test, and to the
 * empty state's prose in one edit, so the next key added is INCAPABLE of
 * reproducing the bug. A block whose entry is missing renders nothing at all,
 * which is a visible failure rather than a silent contradiction.
 *
 * `key` is the config path under `design`; `absence` is how the key's absence
 * reads in the empty state's own sentence.
 */
const GUIDANCE_BLOCKS: readonly {
  readonly key: string
  readonly absence: string
  readonly render: (guidance: Readonly<SovriumDesignExtension>) => readonly Component[]
}[] = [
  {
    key: 'principles',
    absence: 'no principles',
    render: (guidance) => principlesBlock(guidance.principles ?? []),
  },
  {
    key: 'voice',
    absence: 'no voice',
    // One key, two blocks: `tone` is a field OF `design.voice`, so an app
    // cannot declare a tone without declaring a voice, and splitting them into
    // two entries would print `voice` twice in the empty state's key list.
    render: (guidance) => [...voiceBlock(guidance.voice), ...toneBlock(guidance.voice?.tone ?? {})],
  },
  {
    key: 'colorRoles',
    absence: 'no colour roles',
    render: (guidance) => rolesBlock(guidance.colorRoles ?? {}),
  },
  {
    key: 'imagery',
    absence: 'no imagery rules',
    render: (guidance) => imageryBlock(guidance.imagery),
  },
  {
    key: 'components',
    absence: 'no component rules',
    render: (guidance) => componentsBlock(guidance.components ?? {}),
  },
  {
    key: 'zones',
    absence: 'no zone map',
    // Takes the base voice as well as the map, because "how does this zone
    // depart" is not answerable from the zone alone — the inherited half of a
    // per-field override lives in `design.voice`.
    render: (guidance) => zonesBlock(guidance.zones ?? [], guidance.voice),
  },
]

/**
 * What an app that has declared nothing sees — the COMMON case, not the edge.
 *
 * An empty panel reads as a broken page, so the absence has to say what is
 * missing and what fills it. Three things changed here after reading it live
 * against `apps/website`, which declares no `design` block at all:
 *
 *  - It named only `design.voice`, while every key in {@link GUIDANCE_BLOCKS}
 *    feeds this panel. An operator who adds the one key named still gets the
 *    rest of the sections empty.
 *  - The backticks were LITERAL. Nothing renders markdown in a `text` component,
 *    so `` `design.voice` `` reached the page as three characters of syntax the
 *    reader has to mentally strip. Config paths are written bare.
 *  - Its heading was "Voice", nested under a panel already titled "Voice and
 *    usage", so the reader met the same word twice before meeting any content.
 *
 * Both lists below are DERIVED from the registry rather than typed out. The
 * enumeration in prose drifted from the check in code once already — the
 * sentence still said "four keys" while the panel rendered five — and a
 * paragraph that under-reports the config surface is how an operator concludes
 * a key they declared is unsupported.
 */
const noGuidanceYet = (): readonly Component[] => [
  box('flex flex-col gap-2', [
    sectionHeading('Nothing declared yet'),
    text(
      'p',
      'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
      `This app states ${andList(GUIDANCE_BLOCKS.map((block) => block.absence))}. ` +
        'Add them under the design key of your config: ' +
        `${GUIDANCE_BLOCKS.map((block) => block.key).join(', ')}. ` +
        'Each one appears here, and in the exports an agent reads.'
    ),
  ]),
]

/**
 * VOICE — the half of a design system that tokens cannot carry.
 *
 * An operator who can see every colour and still does not know that this app
 * never uses exclamation marks has not been shown its design system. These are
 * the rules a writer (or an agent) has to obey, rendered as readable prose
 * rather than as a config dump.
 *
 * Emptiness is read off the RENDER, not off the config: the panel is empty when
 * every block it renders came back with no components. That is the strongest
 * available form of "derived from the keys the panel actually renders" — a
 * separate `declared` predicate per key would be a second source of truth free
 * to disagree with the block beside it, which is the class of bug this replaces.
 * It is also more correct at the edges: `design: { imagery: {} }` declares the
 * key and states no rule, and reads as empty here because it renders as empty.
 */
export const voiceSection = (document: Readonly<DesignSystemDocument>): readonly Component[] => {
  const guidance = document.$extensions[SOVRIUM_EXTENSION_KEY]
  const blocks = GUIDANCE_BLOCKS.map((block) => block.render(guidance))
  const empty = blocks.every((block) => block.length === 0)

  return [...(empty ? noGuidanceYet() : []), ...blocks.flat()]
}

/** One UI specimen: a named cluster showing a real surface at real tokens. */
const specimen = (label: string, children: readonly Component[]): Component =>
  box('flex flex-col gap-3', [microLabel(label), ...children])

/** One emphasis level, described in prose set at that very level. */
const emphasisRow = (label: string, bodyClass: string, body: string): Component =>
  box('border-border flex flex-col gap-1 border-b py-2 last:border-b-0', [
    microLabel(label),
    text('p', `${bodyClass} leading-relaxed`, body),
  ])

/** Two page surfaces side by side, so their difference is judged and not assumed. */
const surfacesSpecimen = (): Component =>
  box('grid gap-4 md:grid-cols-2', [
    specimen('Card on the page background', [
      card('border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-4', [
        text('p', 'text-foreground text-sm font-medium', 'Raised surface'),
        text(
          'p',
          'text-foreground-subtle text-sm leading-relaxed',
          // States which token is painting, NOT that the result succeeds. The
          // previous line claimed cards "read as lifted"; measured on the
          // platform default, background-raised is 0.995 against a 0.985 page,
          // and the card is separated by its border rather than by its fill. A
          // specimen that asserts an outcome the render does not deliver
          // teaches the reader to distrust the page.
          'Cards are filled with background-raised and bounded by border. How far ' +
            'they lift off the page is whatever those two values put between them.'
        ),
      ]),
    ]),
    specimen('Subtle surface', [
      box('border-border bg-background-subtle flex flex-col gap-2 rounded-lg border p-4', [
        text('p', 'text-foreground text-sm font-medium', 'Subtle surface'),
        text(
          'p',
          'text-foreground-subtle text-sm leading-relaxed',
          'Used for a region that recedes: a sidebar, an inset panel, a quiet toolbar.'
        ),
      ]),
    ]),
  ])

/** Four sizes of running text at the sizes they actually ship at. */
const typeSpecimen = (): Component =>
  box('flex flex-col gap-2', [
    text('p', 'text-foreground text-2xl font-semibold tracking-tight', 'A page title'),
    text('p', 'text-foreground text-lg font-medium', 'A section heading'),
    text(
      'p',
      'text-foreground text-sm leading-relaxed',
      'Body copy at the size most of the product is read at. Long enough to show how ' +
        'line height and measure behave together rather than in isolation.'
    ),
    text('p', 'text-foreground-subtle text-xs', 'A caption, de-emphasised rather than shrunk.'),
  ])

/**
 * The three emphasis levels, EACH SET AT THE LEVEL IT DESCRIBES.
 *
 * They were not, before: all three ran through `guidanceRow`, so a section
 * named "Emphasis" rendered three levels of emphasis in one identical
 * `text-foreground text-sm`. A design system that states a distinction while
 * demonstrating its opposite is worse than one that stays silent, because the
 * reader believes it.
 */
const emphasisSpecimen = (): Component =>
  box('flex flex-col', [
    emphasisRow(
      'Primary',
      'text-foreground text-sm font-medium',
      'The one action a reader is meant to take on this screen.'
    ),
    emphasisRow(
      'Muted',
      'text-foreground-muted text-sm',
      'Present, readable, and clearly not the thing to click.'
    ),
    emphasisRow(
      'Disabled',
      'text-foreground-disabled text-sm',
      'Visible so its position is stable, dimmed so it reads as inert.'
    ),
  ])

/**
 * TOKENS IN USE — the tokens assembled into the surfaces they exist to build.
 *
 * A palette does not tell an operator whether their `background-raised` reads
 * as raised. These clusters put the tokens into the shapes the app actually
 * renders — a card on a page, a muted caption beside body text, a divided list
 * — so the question "does this combination work?" has a visible answer.
 *
 * Deliberately composed from `container` / `text` / `card` / `divider` ONLY. No
 * form, no input: this is a rendered specimen, not a live editor, and A2
 * authorises it only while that stays true.
 */
export const uiKitSection = (): readonly Component[] => [
  sectionHeading('Surfaces'),
  surfacesSpecimen(),
  rule(),
  sectionHeading('Type scale in place'),
  typeSpecimen(),
  rule(),
  sectionHeading('Emphasis'),
  emphasisSpecimen(),
]
