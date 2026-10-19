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
// ─── WHAT IT SHOWS, IN THE ORDER A PERSON ARRIVING READS IT ───────────────
//
// A greeting and one sentence; then what needs attention, one row per thing
// with the one action that answers it, the assistant beside it; four headline
// figures, and the runs of the last seven days under them; and what the configuration declares, one row per kind of object
// with the console page that answers it. The `id`, the `name` and the sidebar
// row's `data-nav-overview` testid are unchanged: a testid is an address, and
// the route is still the console's front page.
//
// ─── ONE READ, NO ISLANDS, FOR EVERYTHING THAT VARIES ──────────────────────
//
// `dataSource` at PAGE level binds a RECORD (the same binding one level down is
// a ROWS binding), so every `$record.*` below resolves SERVER-SIDE and ships as
// text: the attention rows' counts AND details, and the breakdowns beside the
// declarations, for one fetch and zero client bytes.
//
// The head counts are the honest exception: `GET /api/admin/attention` carries
// each declaration's breakdown and none of their head COUNTS, which live on
// `/api/admin/config/reflection`, `/api/admin/links`, `/api/admin/overview` and
// `/api/admin/roles`. A page has exactly one record, so the head counts stay
// `kpi` islands — four shared fetches, since the system-value hook keys its
// query on the endpoint.

import { dashboardContent, sectionCard, sectionCards } from '../components/dashboard-blocks'
import { consolePage } from '../components/data-page'
import { sentence } from '../components/sentence'
import {
  ADMIN_ROLES_ENDPOINT,
  ATTENTION_ENDPOINT,
  AUTOMATIONS_OVERVIEW_ENDPOINT,
  CONFIG_REFLECTION_ENDPOINT,
  LINKS_ENDPOINT,
  OVERVIEW_ENDPOINT,
} from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ───────────────────────────────────────────────────────────── the header
//
// The assistant card renders under `visibility.runtime: 'ai'`, which holds
// wherever an AI provider is configured: every app carries the built-in System
// Agent, so a provider is all it needs. `declares: 'agents'` was refused for
// this switch: an app that declares three agents with no `AI_PROVIDER` set
// would get a composer that cannot answer.

/**
 * The greeting, and the page's ONE visible `h1`.
 *
 * Visible: on a landing page the heading is the greeting, and a greeting
 * nobody can see is not one.
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
 * The assistant: the shipped `ai-chat`, in a card beside the attention list.
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
  type: 'card',
  // A model to answer, AND a caller allowed to act on what it suggests. A
  // read-only operator has the palette in the sidebar; the card is not drawn
  // for them rather than offered as a search box twice. Below `md` it is left
  // out too: on a phone the page is the list of what needs attention.
  visibility: { runtime: 'ai', capability: 'edit-operations' },
  title: '$t:admin.welcome.ask.title',
  description: '$t:admin.welcome.ask.description',
  props: {
    className: 'hidden min-w-0 @5xl/main:flex-1 md:flex',
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
      chatHeight: 264,
      showHistory: false,
      props: {
        // The card is the frame: the panel drops its own border and ground.
        className: 'rounded-none border-0 bg-transparent',
        // Three prompts, drawn under the composer by the suggestion strip, which
        // resolves `suggestions` through the translation table. Keyed, so a
        // French console offers French prompts: a click sends the prompt as the
        // operator's own message, and an English one under a French console
        // reads as the console speaking for them in the wrong language.
        suggestions: [
          '$t:admin.welcome.suggest.failed',
          '$t:admin.welcome.suggest.unset',
          // Answerable on every app: what it declares is in the config the
          // System Agent reads. A prompt about submissions on an app with no
          // form would be the console suggesting a question it cannot answer.
          '$t:admin.welcome.suggest.declares',
        ],
      },
    },
  ],
} as PageComponent

/** The page's header: the greeting over one sentence saying what the page is for. */
const header: PageComponent = {
  type: 'container',
  element: 'header',
  props: { className: 'flex flex-col gap-1 px-4 lg:px-6' },
  children: [
    greeting,
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm text-muted-foreground' },
      content: '$t:admin.welcome.intro',
    },
  ],
} as PageComponent

// ─────────────────────────────────────────────────────────── needs attention

/**
 * One row of the attention list: what is wrong, the detail behind it, and the
 * one action that answers it.
 *
 * `warn` decides the row's icon. Three rows name something BROKEN (a failed
 * run, an unset required variable, a connection to reconnect — expired,
 * unrenewable or never authorised) and carry the destructive icon; the other
 * three (invitations, submissions, organisation findings) are states of
 * ordinary operation and stay neutral.
 */
interface AttentionRow {
  /** The `data-testid` stem and the i18n key suffix. */
  readonly key: string
  /** The `AdminAttentionResponse` count field. */
  readonly count: string
  /** The sibling detail field. Empty string when the count is zero. */
  readonly detail: string
  /** Mount-relative destination that answers this row. */
  readonly href: string
  /** Whether a non-zero count is damage rather than news. */
  readonly warn: boolean
  /**
   * The feature the destination page requires, when it requires one. A row
   * pointing at a page the host does not serve would lead into a 404, so it is
   * not drawn at all — the same declaration that prunes the sidebar row.
   */
  readonly declares?: 'automations' | 'connections' | 'forms'
}

const ATTENTION_ROWS: readonly AttentionRow[] = [
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
    // The Map, the one lens that lists the findings.
    href: '/organisation?tab=map',
    warn: false,
  },
]

/**
 * shadcn's outline button at `sm`, drawn on a `link`: the destination is a
 * literal `href` a reader can open in a new tab, which a `button` with a
 * navigate action does not carry. The ink is spelled out because a bare
 * anchor paints the app's primary.
 */
const OUTLINE_LINK_SM =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground no-underline shadow-xs hover:bg-muted'

/** A component drawn only when the host declares `feature` and the record matches. */
const gated = (
  component: PageComponent,
  visibility: Readonly<Record<string, unknown>>
): PageComponent => ({ ...(component as Record<string, unknown>), visibility }) as PageComponent

/** One attention row; drawn only while its count is above zero. */
const attentionRow = (row: AttentionRow): PageComponent =>
  gated(
    {
      type: 'container',
      element: 'div',
      props: {
        role: 'listitem',
        className: 'flex items-start gap-3 px-(--card-spacing) py-3',
        'data-testid': `welcome-pulse-${row.key}`,
      },
      children: [
        {
          type: 'icon',
          props: {
            name: row.warn ? 'circle-alert' : 'circle-dot',
            size: 16,
            className: `mt-0.5 shrink-0 ${row.warn ? 'text-destructive' : 'text-muted-foreground'}`,
            'aria-hidden': 'true',
          },
        },
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex items-baseline gap-2 text-sm font-medium' },
              children: [
                { type: 'text', element: 'span', content: `$t:admin.welcome.pulse.${row.key}` },
                {
                  type: 'text',
                  element: 'span',
                  props: {
                    className: `tabular-nums ${row.warn ? 'text-destructive' : 'text-muted-foreground'}`,
                    'data-role': 'attention-count',
                  },
                  content: `$record.${row.count}`,
                },
              ],
            },
            {
              type: 'text',
              element: 'p',
              props: {
                className: 'truncate text-sm text-muted-foreground empty:hidden!',
                'data-role': 'attention-detail',
              },
              content: `$record.${row.detail}`,
            },
          ],
        },
        {
          type: 'link',
          props: { href: row.href, className: OUTLINE_LINK_SM },
          content: `$t:admin.welcome.pulse.${row.key}.action`,
        },
      ],
    } as PageComponent,
    {
      ...(row.declares === undefined ? {} : { declares: row.declares }),
      // Only an item that is not at zero is drawn: a list of zeros buries the
      // one figure that moved. The page record is the attention read itself.
      record: { field: row.count, gt: 0 },
    }
  )

/**
 * The quiet instance: one row saying so instead of an empty list.
 *
 * `attentionItems` is the attention read's own count of the items above zero,
 * so this and the rows above are mutually exclusive by construction — exactly
 * one of "nothing to do" and "here is what to do" reaches the page.
 */
const allClear: PageComponent = {
  type: 'container',
  element: 'div',
  visibility: { record: { field: 'attentionItems', eq: 0 } },
  props: { className: 'flex flex-col gap-0.5', 'data-testid': 'welcome-all-clear' },
  children: [
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm font-medium text-foreground' },
      content: '$t:admin.welcome.pulse.allClear',
    },
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm text-muted-foreground' },
      content: '$t:admin.welcome.pulse.allClear.body',
    },
  ],
} as PageComponent

/**
 * The attention list: a card whose title counts what is drawn, one row per
 * figure above zero, each with its own action. The rows sit flush against the
 * card's edges with a hairline between them, as in shadcn's list cards.
 */
const attentionCard: PageComponent = {
  type: 'card',
  title: '$t:admin.welcome.pulse.heading',
  description: '$t:admin.welcome.pulse.since',
  action: {
    type: 'badge',
    badgeVariant: 'secondary',
    visibility: { record: { field: 'attentionItems', gt: 0 } },
    props: { className: 'tabular-nums', 'data-testid': 'welcome-attention-count' },
    content: '$record.attentionItems',
  },
  props: { className: 'h-full', 'data-testid': 'welcome-attention' },
  children: [
    allClear,
    {
      type: 'container',
      element: 'div',
      props: {
        role: 'list',
        className: '-mx-(--card-spacing) -mb-(--card-spacing) divide-y border-t empty:hidden',
        'data-testid': 'welcome-pulse',
      },
      children: ATTENTION_ROWS.map(attentionRow),
    },
  ],
} as PageComponent

/** The attention card as a named region, the width it takes beside the assistant. */
const attention: PageComponent = {
  type: 'container',
  element: 'section',
  props: {
    className: 'min-w-0 @5xl/main:flex-[1.6]',
    'aria-label': '$t:admin.welcome.pulse.region',
  },
  children: [attentionCard],
} as PageComponent

/** The first row: what needs attention, and the assistant beside it. */
const firstRow: PageComponent = {
  type: 'container',
  element: 'div',
  props: { className: 'flex flex-col items-stretch gap-4 px-4 @5xl/main:flex-row lg:px-6' },
  children: [attention, composer],
} as PageComponent

// ─────────────────────────────────────────────────────────── the figures

/**
 * Four headline figures, read from ONE overview read (the four cards share a
 * query, since the system-value hook keys it on the endpoint). The line under
 * each is the attention record's own breakdown, server text, where it has one.
 */
const figureCard = (config: {
  readonly key: string
  readonly valuePath: string
  readonly kpiFormat?: Readonly<Record<string, unknown>>
  readonly sub?: readonly string[]
  readonly declares?: string
}): PageComponent =>
  gated(
    sectionCard({
      testId: `welcome-figure-${config.key}`,
      label: `$t:admin.welcome.figures.${config.key}`,
      endpoint: OVERVIEW_ENDPOINT,
      valuePath: config.valuePath,
      ...(config.kpiFormat === undefined ? {} : { kpiFormat: config.kpiFormat }),
      footer:
        config.sub === undefined
          ? []
          : ([sentence('text-sm text-muted-foreground', config.sub)] as readonly PageComponent[]),
    }),
    config.declares === undefined ? {} : { declares: config.declares }
  )

const figures: PageComponent = sectionCards(
  [
    figureCard({
      key: 'runs',
      valuePath: 'runs.recent',
      sub: ['$record.failedRuns', ' ', '$t:admin.welcome.figures.runs.sub'],
      declares: 'automations',
    }),
    figureCard({
      key: 'submissions',
      valuePath: 'submissions.total',
      sub: ['$record.recentSubmissions', ' ', '$t:admin.welcome.figures.submissions.sub'],
      declares: 'forms',
    }),
    figureCard({
      key: 'accounts',
      valuePath: 'users.total',
      sub: ['$t:admin.welcome.sub.banned', ' ', '$record.usersBanned'],
    }),
    figureCard({
      key: 'storage',
      valuePath: 'storage.totalBytes',
      kpiFormat: { type: 'bytes' },
      sub: [
        '$record.bucketsLocal',
        ' ',
        '$t:admin.welcome.sub.local',
        ' · ',
        '$record.bucketsS3',
        ' s3',
      ],
      declares: 'buckets',
    }),
  ],
  {
    'data-testid': 'welcome-figures',
    'aria-label': '$t:admin.welcome.figures.region',
    // dashboard-01's grid with one change: TWO columns from the smallest
    // width, where the block starts at one. A figure is a word and a number,
    // and four of them one per row pushed a phone's declarations a screen down.
    className: 'grid grid-cols-2 gap-4 px-4 @5xl/main:grid-cols-4 lg:px-6',
  }
)

/**
 * The runs of the last seven days, one bar per day, under the figures. The
 * automation overview read publishes its buckets at the top level (`points`),
 * the one key a chart can bind. Drawn where the app declares an automation,
 * as the runs figure is.
 */
const runsChart: PageComponent = gated(
  {
    // The section carries the name: the chart island keeps its own host
    // attributes, so a label passed to it does not land on the drawn element.
    type: 'container',
    element: 'section',
    props: {
      className: 'px-4 lg:px-6',
      'data-testid': 'welcome-runs-chart',
      'aria-label': '$t:admin.welcome.runsChart.region',
    },
    children: [
      {
        type: 'chart',
        dataSource: {
          system: {
            endpoint: AUTOMATIONS_OVERVIEW_ENDPOINT,
            rowsKey: 'points',
            query: { period: '7d' },
          },
        },
        chartType: 'bar',
        xAxis: { field: 'timestamp', format: 'date' },
        yAxis: { field: 'runs', gridLines: true },
        series: [
          { field: 'runs', label: '$t:admin.welcome.runsChart.runs' },
          { field: 'failures', label: '$t:admin.welcome.runsChart.failures' },
        ],
      },
    ],
  } as PageComponent,
  { declares: 'automations' }
)

// ───────────────────────────────────────────────────── what the app declares

/**
 * The declarations list: one row per kind of object the configuration
 * declares, the console page that answers it on the left, the count and its
 * breakdown on the right.
 *
 * The ORDER is the console's own, data before people before audience: what is
 * stored, what runs on it, what comes in, who talks to it, where files sit,
 * then the accounts, the public pages, the links and the roles.
 *
 * The head counts are `kpi` figures because they live on four reads the page
 * record does not carry (`/api/admin/config/reflection`, `/api/admin/links`,
 * `/api/admin/overview`, `/api/admin/roles`); the breakdowns are the attention
 * record's server text.
 */
/*
 * A count beside a NOUN leads with the noun ("Banned: 1", "Bannis : 1"): the
 * console's copy has no plural forms, and a number before a noun is wrong in
 * one language or the other for some count. A count beside a word that does
 * not agree with it ("2 paused", "2 en pause") keeps the number first.
 */
interface DeclaredRow {
  readonly key: string
  readonly label: string
  readonly endpoint: string
  readonly valuePath: string
  readonly sub?: readonly string[]
  /** The feature the row counts, when the app may not declare it at all. */
  readonly declares?: 'tables' | 'automations' | 'agents' | 'buckets' | 'forms' | 'links'
  /** Mount-relative page that answers the count. */
  readonly href: string
  /**
   * The capability that page requires, when the row itself is drawn without
   * one: the row keeps its words but they do not lead into a 404.
   */
  readonly hrefDeclares?: 'pages' | 'data'
}

const DECLARED_ROWS: readonly DeclaredRow[] = [
  {
    key: 'tables',
    label: '$t:admin.common.tables',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'tableCount',
    sub: ['$t:admin.welcome.sub.fields', ' ', '$record.tableFields'],
    declares: 'tables',
    href: '/records',
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
    href: '/runs',
  },
  {
    key: 'forms',
    label: '$t:admin.common.forms',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'formCount',
    declares: 'forms',
    href: '/submissions',
  },
  {
    // The figure is what the app DECLARES; the built-in System Agent every
    // app carries is added beside it ("+ 1 built-in") rather than folded in,
    // so the headline and the line beside it can never read as two answers.
    key: 'agents',
    label: '$t:admin.common.agents',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'agentCount',
    sub: ['+ ', '$record.agentsSystem', ' ', '$t:admin.welcome.sub.builtIn'],
    declares: 'agents',
    href: '/conversations',
  },
  {
    // Declared buckets first, split by store, so the two figures add up to
    // the headline; the built-in System bucket follows as an addition.
    key: 'buckets',
    label: '$t:admin.common.buckets',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'bucketCount',
    sub: [
      '$record.bucketsLocal',
      ' ',
      '$t:admin.welcome.sub.local',
      ' · ',
      '$record.bucketsS3',
      ' s3 · + ',
      '$record.bucketsSystem',
      ' ',
      '$t:admin.welcome.sub.builtIn',
    ],
    declares: 'buckets',
    href: '/files',
  },
  {
    key: 'users',
    label: '$t:admin.common.users',
    endpoint: OVERVIEW_ENDPOINT,
    valuePath: 'users.total',
    sub: ['$t:admin.welcome.sub.banned', ' ', '$record.usersBanned'],
    href: '/users',
  },
  {
    key: 'pages',
    label: '$t:admin.common.pages',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'pageCount',
    href: '/analytics',
    hrefDeclares: 'pages',
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
    href: '/links',
  },
  {
    key: 'roles',
    label: '$t:admin.common.roles',
    endpoint: ADMIN_ROLES_ENDPOINT,
    valuePath: 'total',
    sub: ['$t:admin.welcome.sub.teams', ' ', '$record.teams'],
    href: '/organisation',
    hrefDeclares: 'data',
  },
]

/** The row's page name: a link where the page is served, plain words where it is not. */
const declaredName = (row: DeclaredRow): readonly PageComponent[] => {
  const words = `$t:admin.welcome.counts.${row.key}.where`
  const link = {
    type: 'link',
    props: {
      href: row.href,
      className: 'font-medium text-foreground underline-offset-4 hover:underline',
    },
    content: words,
  } as PageComponent
  if (row.hrefDeclares === undefined) return [link]
  return [
    gated(link, { declares: row.hrefDeclares }),
    gated(
      {
        type: 'text',
        element: 'span',
        props: { className: 'font-medium text-foreground' },
        content: words,
      } as PageComponent,
      { unlessDeclares: row.hrefDeclares }
    ),
  ]
}

/**
 * The head count, drawn by a `kpi` reduced to its figure: the island's card
 * chrome is flattened (its two size containers too, which would otherwise
 * measure the figure at zero width inside a row), its label kept for assistive technology only (the
 * visible noun is the text beside it), and its value set at the row's size.
 */
const declaredCount = (row: DeclaredRow): PageComponent =>
  ({
    type: 'kpi',
    label: row.label,
    dataSource: { system: { endpoint: row.endpoint, valuePath: row.valuePath } },
    kpiFormat: { type: 'number' },
    props: {
      className:
        'shrink-0 gap-0 [container-type:normal] [&_[data-slot=card-header]]:[container-type:normal] border-0 bg-transparent py-0 shadow-none ring-0 [--card-spacing:0px]! [&_[data-role=kpi-label]]:sr-only [&_[data-role=kpi-value]]:text-sm [&_[data-role=kpi-value]]:font-medium [&_[data-role=kpi-value]]:text-foreground',
    },
  }) as PageComponent

const declaredRow = (row: DeclaredRow): PageComponent => {
  const component = {
    type: 'container',
    element: 'div',
    props: {
      role: 'listitem',
      className: 'flex min-h-10 items-center gap-3 px-(--card-spacing) py-2 text-sm',
      'data-testid': `welcome-tile-${row.key}`,
    },
    children: [
      ...declaredName(row),
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'ml-auto flex min-w-0 items-baseline gap-2 text-muted-foreground',
        },
        children: [
          ...(row.sub === undefined
            ? []
            : [
                sentence('hidden truncate text-sm text-muted-foreground sm:block', [
                  ...row.sub,
                  ' ·',
                ]),
              ]),
          { type: 'text', element: 'span', content: row.label },
          declaredCount(row),
        ],
      },
    ],
  } as PageComponent
  return row.declares === undefined ? component : gated(component, { declares: row.declares })
}

const declaredCard: PageComponent = {
  type: 'card',
  title: '$t:admin.welcome.counts.heading',
  description: '$t:admin.welcome.counts.description',
  children: [
    {
      type: 'container',
      element: 'div',
      props: {
        role: 'list',
        className: '-mx-(--card-spacing) -mb-(--card-spacing) divide-y border-t',
        'data-testid': 'welcome-counts',
      },
      children: DECLARED_ROWS.map(declaredRow),
    },
  ],
} as PageComponent

const declared: PageComponent = {
  type: 'container',
  element: 'section',
  props: { className: 'px-4 lg:px-6', 'aria-label': '$t:admin.welcome.counts.region' },
  children: [declaredCard],
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
  body: [dashboardContent([header, firstRow, figures, runsChart, declared])],
}) satisfies PageConfig
