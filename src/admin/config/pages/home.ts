/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's root — Welcome, the landing page an operator arrives on.
//
// PATHS ARE MOUNT-RELATIVE. This page is `/`, not `/_admin`: the console is
// served at one fixed base, `/_admin`, and the mount primitive prefixes every
// intra-app path with it at render time. Writing `/_admin` here would double the
// prefix rather than confirm it.
//
// ─── WHAT REPLACED WHAT ────────────────────────────────────────────────────
//
// This route used to be the Dashboard: seven `kpi` islands over
// `/api/admin/overview` and a recent-activity grid. Round 7 of the console
// canvas replaced it with a landing page whose shape is a greeting, one thing to
// DO, and then what needs attention — the order a person arriving actually reads
// in. The `id`, the `name` and the sidebar row's `data-nav-overview` testid are
// deliberately unchanged: a testid is an address, and the route is still the
// console's front page.
//
// The activity grid moved nowhere and is simply gone from `/`. It answered
// "what just happened" for a reader who had already decided to audit; the pulse
// strip below answers "what needs me" for a reader who has not decided anything
// yet, which is the question a landing page is for.
//
// ─── ONE READ, NO ISLANDS, FOR EVERYTHING THAT VARIES ──────────────────────
//
// `dataSource` at PAGE level binds a RECORD (the same binding one level down is
// a ROWS binding), so every `$record.*` below resolves SERVER-SIDE and ships as
// text. That is what lets the six pulse cells carry twelve live values —
// counts AND their detail strings — for one fetch and zero client bytes. Twelve
// `kpi` islands could not have carried the detail strings at all: a `kpi` has
// one value slot.
//
// The nine tiles are the honest exception, and the reason is measured rather
// than assumed: `GET /api/admin/attention` carries each tile's SUB-LINE
// (`tableFields`, `bucketsS3`, `linksDb`, …) and none of their head COUNTS,
// which live on `/api/admin/config/reflection`, `/api/admin/links`,
// `/api/admin/overview` and `/api/admin/roles`. A page has exactly one record,
// so the head counts stay `kpi` islands — four shared fetches across nine tiles,
// since the system-value hook keys its query on the endpoint — and the
// sub-lines are server text beneath them.

import { CARD_SURFACE } from '../components/card'
import { dashboardContent, sectionCard, sectionCards } from '../components/dashboard-blocks'
import { consolePage } from '../components/data-page'
import { sentence } from '../components/sentence'
import {
  ADMIN_ROLES_ENDPOINT,
  ATTENTION_ENDPOINT,
  CONFIG_REFLECTION_ENDPOINT,
  LINKS_ENDPOINT,
  OVERVIEW_ENDPOINT,
} from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ───────────────────────────────────────────────────────────── the hero
//
// Two containers, one of which renders. `visibility.runtime: 'ai'` holds
// wherever an AI provider is configured: every app carries the built-in System
// Agent, so a provider is all the composer needs. `declares: 'agents'` was
// refused for this switch and the reason is visible here: an app that declares
// three agents with no `AI_PROVIDER` set would get a composer that cannot answer.

/**
 * The greeting, and the page's ONE visible `h1`.
 *
 * Visible rather than `sr-only`, which is the round-7 departure from every other
 * console page: on a landing page the heading is the greeting, and a greeting
 * nobody can see is not one. Every other surface keeps its title in the
 * breadcrumb and its `h1` hidden.
 *
 * It NAMES THE OPERATOR, and the string is where that happens — this component
 * is unchanged. `admin.welcome.heading` reads `Welcome[, $session.name]`, an
 * optional segment: the bracketed clause survives only if the token inside it
 * resolves, so a caller with no name — and an anonymous one — reads plain
 * "Welcome" rather than a stranded "Welcome,".
 *
 * The name resolves in the BROWSER, and that is deliberate rather than a limit
 * to route around: the mount's SSR pass is session-less by design, because a
 * server-rendered name is one caller's identity baked into a page another
 * caller can be served. What the server ships is the FALLBACK, and hydration
 * ADDS the name — so the heading is a complete sentence at every instant and
 * never corrects itself, and the `h1` a spec holds is the one the server
 * carries. A bare `$session.name` heading would instead have arrived empty.
 *
 * The canvas drew "Good afternoon, Thomas" until round 8, which dropped the
 * time of day: no config primitive yields one, and the server does not know the
 * reader's local hour — it would take a SECOND browser-resolved value to say
 * something no operator asked to be told.
 */
const greeting: PageComponent = {
  type: 'text',
  element: 'h1',
  props: { className: 'text-2xl font-semibold tracking-tight', 'data-testid': 'welcome-greeting' },
  content: '$t:admin.welcome.heading',
} as PageComponent

/**
 * The composer: the shipped `ai-chat`, centred, in the place the search takes
 * when there is no AI.
 *
 * Its options sit beside `type`, where the renderer reads them first
 * (`readChatOption` in `render/registry/ai-chat-component.tsx`); `props` holds
 * only `suggestions`, which the renderer still reads from there alone.
 *
 * ─── IT NAMES THE BUILT-IN `system` AGENT ─────────────────────────────────
 *
 * This file is the console's own preset — frozen into the binary, rendered
 * against an operator's app whose agent names are unknowable when this line is
 * written. The one agent it CAN name is the built-in System Agent every app
 * carries: its prompt describes the operator's app and its tools read that
 * app's data as the signed-in operator, never writing.
 */
const composer: PageComponent = {
  type: 'container',
  element: 'div',
  // A model to answer, AND a caller allowed to act on what it suggests: a
  // read-only operator is offered search instead, below.
  visibility: { runtime: 'ai', capability: 'edit-operations' },
  props: {
    className: 'flex w-full max-w-2xl flex-col gap-4',
    'data-testid': 'welcome-composer',
  },
  children: [
    {
      type: 'ai-chat',
      agent: 'system',
      placeholder: '$t:admin.common.askApp',
      // The ⌘K palette's « Ask about this app » row lands here with the typed
      // words in `?q=`: the composer takes them as a draft, focused and unsent.
      draftParam: 'q',
      chatHeight: 220,
      showHistory: false,
      props: {
        // Three prompts, drawn under the composer by the suggestion strip, which
        // resolves `suggestions` through the translation table. Keyed, so a
        // French console offers French prompts: a click sends the prompt as the
        // operator's own message, and an English one under a French console
        // reads as the console speaking for them in the wrong language.
        suggestions: [
          '$t:admin.welcome.suggest.failed',
          '$t:admin.welcome.suggest.unset',
          '$t:admin.welcome.suggest.submissions',
        ],
      },
    },
  ],
} as PageComponent

/**
 * The search hero: what stands in the composer's place when AI cannot run.
 *
 * `variant: 'secondary'` is load-bearing and not cosmetic — the same lesson the
 * sidebar's trigger records. A `button` with no variant gets `default`, the
 * PRIMARY tone, and a className carrying a border and a text colour but no
 * ground leaves the recipe's near-black fill showing through: a black slab with
 * subtle-grey placeholder text on it.
 *
 * The hook is `data-command-palette-trigger`, never the accessible name:
 * `CommandPaletteCapture` delegates from `document` on `closest(…)`, so the
 * control works before the palette island hydrates and after the label is
 * translated.
 *
 * ─── IT NAMES ITSELF APART FROM THE SIDEBAR'S TRIGGER ──────────────────────
 *
 * This is the ONE surface carrying two palette triggers: this one and the
 * sidebar's, which is on every page. They both read `$t:admin.shell.search`
 * until round 7's Welcome landed, and then a reader listing this page's buttons
 * heard "Search" twice with nothing to choose between them — the plainest form
 * of the same-name defect, two controls doing one thing under one label.
 *
 * So the hero gets its own key. The sidebar keeps the bare verb because it is
 * the standing affordance on every other surface and has no rival there; the
 * hero says what it searches, in the words of its own caption two lines down.
 * Not `sr-only` text or a `title`: `aria-label` is the slot that RESOLVES a
 * `$t:` token on a plain element (the measured table in `i18n/console.ts`), so
 * it is the only one that keeps the name translatable.
 */
const searchHero = (visibility: Readonly<Record<string, unknown>>, note: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility,
    props: {
      className: 'flex w-full max-w-2xl flex-col items-center gap-2',
      'data-testid': 'welcome-search-hero',
    },
    children: [
      {
        type: 'button',
        variant: 'outline',
        props: {
          type: 'button',
          'aria-label': '$t:admin.welcome.searchHero',
          'data-command-palette-trigger': 'true',
          'data-testid': 'welcome-search-trigger',
          className:
            'h-10 w-full justify-start gap-2 bg-muted/50 px-3 text-sm font-normal text-muted-foreground shadow-none',
        },
        children: [
          { type: 'icon', props: { name: 'search', size: 16, className: 'shrink-0' } },
          {
            type: 'text',
            element: 'span',
            props: { className: 'flex-1 text-left' },
            content: '$t:admin.shell.searchPlaceholder',
          },
          { type: 'kbd', keys: ['⌘', 'K'] },
        ],
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-xs text-muted-foreground' },
        content: note,
      },
    ],
  }) as PageComponent

const hero: PageComponent = {
  type: 'container',
  element: 'section',
  props: {
    className: 'flex flex-col items-center gap-6 px-4 pt-6 pb-2 lg:px-6',
    'aria-label': '$t:admin.welcome.heroRegion',
  },
  children: [
    greeting,
    composer,
    searchHero({ unlessRuntime: 'ai' }, '$t:admin.welcome.noAi'),
    // The same search for the read-only operator on an instance that HAS a
    // model: the composer is withheld from them, and the hero must not go
    // blank. `visibility` ANDs its keys, so "no model OR read-only" is two
    // copies under disjoint gates, and exactly one of the three reaches the page.
    searchHero(
      { runtime: 'ai', unlessCapability: 'edit-operations' },
      '$t:admin.welcome.readOnlySearch'
    ),
  ],
} as PageComponent

// ─────────────────────────────────────────────────────────── the pulse strip

/**
 * One cell of the strip: a count, what it counts, the detail behind it, and the
 * console that answers it.
 *
 * `warn` decides whether a non-zero count is painted red. Three of the six
 * cells name something BROKEN (a failed run, an unset required variable, a
 * connection to reconnect — expired, unrenewable or never authorised); the
 * other three (invitations, submissions, a deliberately
 * paused automation) are states of ordinary operation and stay neutral. The
 * figure is a `kpi` with `thresholds` from 1, so the colour follows the value.
 */
interface PulseCell {
  /** The `data-testid` stem and the i18n key suffix. */
  readonly key: string
  /** The `AdminAttentionResponse` count field. */
  readonly count: string
  /** The sibling detail field. Empty string when the count is zero. */
  readonly detail: string
  /** Mount-relative destination that answers this cell. */
  readonly href: string
  /** Whether a non-zero count is damage rather than news. */
  readonly warn: boolean
  /** Whether the link names the count itself ("3 findings →"). */
  readonly countInLink?: boolean
  /**
   * The feature the destination page requires, when it requires one. A cell
   * pointing at a page the host does not serve would lead into a 404, so it is
   * not drawn at all — the same declaration that prunes the sidebar row.
   */
  readonly declares?: 'automations' | 'connections' | 'forms'
}

const PULSE_CELLS: readonly PulseCell[] = [
  {
    key: 'failedRuns',
    count: 'failedRuns',
    detail: 'failedRunsDetail',
    href: '/runs',
    warn: true,
    declares: 'automations',
  },
  {
    key: 'variablesUnset',
    count: 'variablesUnset',
    detail: 'variablesUnsetDetail',
    href: '/env',
    warn: true,
  },
  {
    key: 'tokensExpired',
    count: 'tokensExpired',
    detail: 'tokensExpiredDetail',
    href: '/connections',
    warn: true,
    declares: 'connections',
  },
  {
    key: 'invitationsPending',
    count: 'invitationsPending',
    detail: 'invitationsPendingDetail',
    href: '/users',
    warn: false,
  },
  {
    key: 'recentSubmissions',
    count: 'recentSubmissions',
    detail: 'recentSubmissionsDetail',
    href: '/submissions',
    warn: false,
    declares: 'forms',
  },
  {
    key: 'findingsCount',
    count: 'findingsCount',
    detail: 'findingsDetail',
    href: '/organisation',
    warn: false,
    countInLink: true,
  },
]

/** A component drawn only when the host declares `feature`, or always when none is named. */
const withDeclares = (
  feature: string | undefined,
  component: PageComponent,
  record?: Readonly<Record<string, unknown>>
): PageComponent =>
  feature === undefined && record === undefined
    ? component
    : ({
        ...(component as Record<string, unknown>),
        visibility: {
          ...(feature === undefined ? {} : { declares: feature }),
          ...(record === undefined ? {} : { record }),
        },
      } as PageComponent)

/** One attention card: the figure from the attention read, its detail, the way to fix it. */
const pulseCard = (cell: PulseCell): PageComponent =>
  withDeclares(
    cell.declares,
    sectionCard({
      testId: `welcome-pulse-${cell.key}`,
      label: `$t:admin.welcome.pulse.${cell.key}`,
      endpoint: ATTENTION_ENDPOINT,
      valuePath: cell.count,
      attention: cell.warn,
      footer: [
        {
          // shadcn's section-card footer: a column, the detail over the way to fix it.
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5 text-sm' },
          children: [
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-muted-foreground empty:hidden!' },
              content: `$record.${cell.detail}`,
            },
            {
              type: 'link',
              props: {
                href: cell.href,
                className:
                  'text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
              },
              // The findings link names its count ("3 findings →"): a figure
              // inside a translated sentence does not substitute, so the count
              // is its own node before the translated words.
              ...(cell.countInLink === true
                ? {
                    children: [
                      { type: 'text', element: 'span', content: `$record.${cell.count}` },
                      { type: 'text', element: 'span', content: ' ' },
                      {
                        type: 'text',
                        element: 'span',
                        content: `$t:admin.welcome.pulse.${cell.key}.where`,
                      },
                    ],
                  }
                : { content: `$t:admin.welcome.pulse.${cell.key}.where` }),
            },
          ],
        },
      ] as readonly PageComponent[],
    }),
    // Only an item that is not at zero is drawn: a list of zeros buries the
    // one figure that moved. The page record is the attention read itself.
    { field: cell.count, gt: 0 }
  )

/** A section heading over a card grid, on the content column's gutter. */
const sectionHeading = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'h2',
    props: { className: 'px-4 text-sm font-medium text-muted-foreground lg:px-6' },
    content,
  }) as PageComponent

/**
 * The quiet instance: one sentence instead of a row of zeros.
 *
 * `attentionItems` is the attention read's own count of the items above zero,
 * so this and the cards above are mutually exclusive by construction — exactly
 * one of "nothing to do" and "here is what to do" reaches the page.
 */
const allClear: PageComponent = {
  type: 'container',
  element: 'div',
  visibility: { record: { field: 'attentionItems', eq: 0 } },
  props: {
    className: `${CARD_SURFACE} mx-4 flex flex-col gap-1 p-4 lg:mx-6`,
    'data-testid': 'welcome-all-clear',
  },
  children: [
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground text-sm font-medium' },
      content: '$t:admin.welcome.pulse.allClear',
    },
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-muted-foreground text-sm' },
      content: '$t:admin.welcome.pulse.allClear.body',
    },
  ],
} as PageComponent

const pulse: PageComponent = {
  type: 'container',
  element: 'section',
  props: { className: 'flex flex-col gap-3', 'aria-label': '$t:admin.welcome.pulse.region' },
  children: [
    sectionHeading('$t:admin.welcome.pulse.heading'),
    allClear,
    sectionCards(PULSE_CELLS.map(pulseCard), { 'data-testid': 'welcome-pulse' }),
  ],
} as PageComponent

/**
 * The second section: what the configuration declares, one section card per
 * kind of object, each with the breakdown the reader asks next as its footer.
 */
interface CountTile {
  readonly key: string
  readonly label: string
  readonly endpoint: string
  readonly valuePath: string
  readonly sub?: readonly string[]
  /** The feature the tile counts, when the app may not declare it at all. */
  readonly declares?: 'tables' | 'automations' | 'agents' | 'buckets' | 'forms' | 'links'
}

const COUNT_TILES: readonly CountTile[] = [
  {
    key: 'pages',
    label: '$t:admin.common.pages',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'pageCount',
  },
  {
    key: 'tables',
    label: '$t:admin.common.tables',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'tableCount',
    sub: ['$record.tableFields', ' ', '$t:admin.welcome.sub.fields'],
    declares: 'tables',
  },
  {
    key: 'automations',
    label: '$t:admin.common.automations',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'automationCount',
    sub: [
      '$record.automationsPaused',
      ' ',
      '$t:admin.welcome.sub.paused',
      ' · ',
      '$record.automationsDisabled',
      ' ',
      '$t:admin.welcome.sub.disabled',
    ],
    declares: 'automations',
  },
  {
    key: 'agents',
    label: '$t:admin.common.agents',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'agentCount',
    sub: ['$record.agentsSystem', ' ', '$t:admin.welcome.sub.builtIn'],
    declares: 'agents',
  },
  {
    key: 'buckets',
    label: '$t:admin.common.buckets',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'bucketCount',
    sub: [
      '$record.bucketsSystem',
      ' ',
      '$t:admin.welcome.sub.builtIn',
      ' · ',
      '$record.bucketsS3',
      ' s3 · ',
      '$record.bucketsLocal',
      ' ',
      '$t:admin.welcome.sub.local',
    ],
    declares: 'buckets',
  },
  {
    key: 'forms',
    label: '$t:admin.common.forms',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'formCount',
    declares: 'forms',
  },
  {
    key: 'links',
    label: '$t:admin.common.links',
    endpoint: LINKS_ENDPOINT,
    valuePath: 'total',
    sub: [
      '$record.linksConfig',
      ' ',
      '$t:admin.welcome.sub.config',
      ' · ',
      '$record.linksDb',
      ' ',
      '$t:admin.welcome.sub.db',
    ],
    declares: 'links',
  },
  {
    key: 'users',
    label: '$t:admin.common.users',
    endpoint: OVERVIEW_ENDPOINT,
    valuePath: 'users.total',
    sub: ['$record.usersBanned', ' ', '$t:admin.welcome.sub.banned'],
  },
  {
    key: 'roles',
    label: '$t:admin.common.roles',
    endpoint: ADMIN_ROLES_ENDPOINT,
    valuePath: 'total',
    sub: ['$record.teams', ' ', '$t:admin.welcome.sub.teams'],
  },
]

const countCard = (tile: CountTile): PageComponent =>
  withDeclares(
    tile.declares,
    sectionCard({
      testId: `welcome-tile-${tile.key}`,
      label: tile.label,
      endpoint: tile.endpoint,
      valuePath: tile.valuePath,
      ...(tile.sub === undefined
        ? {}
        : {
            footer: [
              sentence('text-sm text-muted-foreground', tile.sub),
            ] as readonly PageComponent[],
          }),
    })
  )

const counts: PageComponent = {
  type: 'container',
  element: 'section',
  props: { className: 'flex flex-col gap-3', 'aria-label': '$t:admin.welcome.counts.region' },
  children: [
    sectionHeading('$t:admin.welcome.counts.heading'),
    sectionCards(COUNT_TILES.map(countCard), { 'data-testid': 'welcome-counts' }),
  ],
} as PageComponent

export default consolePage({
  id: 'dashboard-overview',
  path: '/',
  title: '$t:admin.meta.welcome',
  page: {
    // The page RECORD. Every `$record.*` above resolves from this one read,
    // server-side, with no island.
    dataSource: { system: { endpoint: ATTENTION_ENDPOINT } },
  },
  shell: { flush: true },
  body: [dashboardContent([hero, pulse, counts])],
}) satisfies PageConfig
