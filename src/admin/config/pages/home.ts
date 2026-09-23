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

import { withShell } from '../components/shell'
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
// Two containers, one of which renders. `visibility.runtime: 'ai'` is the
// conjunction `appRequiresAi(hostApp) ∧ isAiProviderConfigured(env)` — the same
// predicate that decides whether the server prints its `AI disabled` boot
// warning. `declares: 'agents'` alone was refused for this switch and the reason
// is visible here: an app that declares three agents with no `AI_PROVIDER` set
// would get a composer that cannot answer.

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
 * ─── EVERYTHING IT READS IS INSIDE `props`, AND THAT IS NOT A STYLE CHOICE ──
 *
 * `ai-chat` resolves `agent`, `placeholder`, `chatHeight`, `showHistory` and
 * `suggestions` off `rawProps` — the merged prop bag — and off nothing else
 * (`render/registry/ai-chat-component.tsx`). `props` is an open bag, so the same
 * keys authored at component top level DECODE, validate, typecheck and then
 * reach no renderer at all. Measured live on this branch before authoring.
 *
 * ─── IT NAMES NO AGENT, AND THAT IS A GAP RATHER THAN A DECISION ───────────
 *
 * The canvas binds the composer to the host's DEFAULT agent. `ai-chat.agent`
 * takes a literal agent NAME, and this file is the console's own preset — frozen
 * into the binary, rendered against an operator's app whose agent names are
 * unknowable when this line is written. There is no `$app.defaultAgent` binding
 * and `$record.*` cannot reach `props` on an island. So the chat is unbound: it
 * posts to `POST /api/ai/chat` with no `agent`, which is a valid turn without
 * the agent's system prompt, model or table grants. Routed, not faked.
 */
const composer: PageComponent = {
  type: 'container',
  element: 'div',
  visibility: { runtime: 'ai' },
  props: {
    className: 'flex w-full max-w-2xl flex-col gap-4',
    'data-testid': 'welcome-composer',
  },
  children: [
    {
      type: 'ai-chat',
      props: {
        placeholder: 'Ask about this app…',
        chatHeight: 220,
        showHistory: false,
        // Three prompts, drawn under the composer by the suggestion strip. They
        // are literals rather than `$t:` tokens on purpose: the strip resolves
        // `suggestions` through the translation table itself, so a key WOULD
        // resolve — but every prompt here names a CONSOLE noun ("runs",
        // "submissions") whose translation already lives in the sidebar, and a
        // fourth spelling of each would be a fourth thing to keep in step.
        suggestions: [
          'What failed since this instance started?',
          'Which required variables are unset?',
          'Summarise this week’s submissions',
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
const searchHero: PageComponent = {
  type: 'container',
  element: 'div',
  visibility: { unlessRuntime: 'ai' },
  props: {
    className: 'flex w-full max-w-2xl flex-col items-center gap-2',
    'data-testid': 'welcome-search-hero',
  },
  children: [
    {
      type: 'button',
      variant: 'secondary',
      props: {
        type: 'button',
        'aria-label': '$t:admin.welcome.searchHero',
        'data-command-palette-trigger': 'true',
        'data-testid': 'welcome-search-trigger',
        className:
          'border-border text-foreground-subtle hover:text-foreground flex h-11 w-full items-center justify-start gap-2 rounded-md px-4 text-md font-normal',
      },
      children: [
        { type: 'icon', props: { name: 'search', size: 16, className: 'shrink-0' } },
        {
          type: 'text',
          element: 'span',
          props: { className: 'flex-1 text-left' },
          content: '$t:admin.shell.searchPlaceholder',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-foreground-subtle text-sm' },
          content: '⌘K',
        },
      ],
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-foreground-subtle text-xs' },
      content: '$t:admin.welcome.noAi',
    },
  ],
} as PageComponent

const hero: PageComponent = {
  type: 'container',
  element: 'section',
  props: {
    className: 'flex flex-col items-center gap-6 px-4 pt-10 pb-6',
    'aria-label': '$t:admin.welcome.heroRegion',
  },
  children: [greeting, composer, searchHero],
} as PageComponent

// ─────────────────────────────────────────────────────────── the pulse strip

/**
 * One cell of the strip: a count, what it counts, the detail behind it, and the
 * console that answers it.
 *
 * `warn` decides whether a non-zero count is toned. Three of the six cells name
 * something BROKEN — a failed run, an unset required variable, an expired token
 * — and [internal ref] D3 reserves colour for consequence, which is exactly that. The
 * other three (invitations, submissions, a deliberately paused automation) are
 * states of ordinary operation and stay monochrome; toning them would spend the
 * one surviving ramp on news rather than on damage.
 *
 * A toned cell is carried TWICE, gated on `gt: 0` and `lte: 0` against the page
 * record. That is the only way config expresses "colour this if it is not zero":
 * `visibility.record` compares numerically, and there is no conditional class.
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
}

const PULSE_CELLS: readonly PulseCell[] = [
  {
    key: 'failedRuns',
    count: 'failedRuns',
    detail: 'failedRunsDetail',
    href: '/automations',
    warn: true,
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
    href: '/forms',
    warn: false,
  },
  {
    key: 'automationsPaused',
    count: 'automationsPaused',
    detail: 'automationsPausedDetail',
    href: '/automations',
    warn: false,
  },
]

const COUNT_CLASS = 'font-mono text-xl leading-6'

/** The count, toned or not — one node when plain, two gated ones when `warn`. */
const pulseCount = (cell: PulseCell): readonly PageComponent[] =>
  cell.warn
    ? ([
        {
          type: 'text',
          element: 'span',
          visibility: { record: { field: cell.count, gt: 0 } },
          props: { className: `text-error-fg ${COUNT_CLASS}` },
          content: `$record.${cell.count}`,
        },
        {
          type: 'text',
          element: 'span',
          visibility: { record: { field: cell.count, lte: 0 } },
          props: { className: `text-foreground ${COUNT_CLASS}` },
          content: `$record.${cell.count}`,
        },
      ] as readonly PageComponent[])
    : ([
        {
          type: 'text',
          element: 'span',
          props: { className: `text-foreground ${COUNT_CLASS}` },
          content: `$record.${cell.count}`,
        },
      ] as readonly PageComponent[])

const pulseCellNode = (cell: PulseCell): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex min-w-0 flex-col gap-0.5 px-4 py-3',
      'data-testid': `welcome-pulse-${cell.key}`,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-baseline gap-2' },
        children: [
          ...pulseCount(cell),
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-md font-medium' },
            content: `$t:admin.welcome.pulse.${cell.key}`,
          },
        ],
      },
      // `empty:hidden!` rather than a second gated node: a zero cell's detail
      // string is `''` by contract, and an empty span would otherwise reserve a
      // line and pull the strip's cells out of vertical agreement.
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle truncate text-xs empty:hidden!' },
        content: `$record.${cell.detail}`,
      },
      {
        type: 'link',
        props: {
          href: cell.href,
          // `mt-auto` rather than a top margin: the grid stretches every cell
          // to the tallest, and one label wrapping to two lines ("required
          // variables unset" does, at every width above `sm`) would otherwise
          // leave six destinations on five different baselines.
          className: 'text-foreground-subtle hover:text-foreground mt-auto pt-1 text-xs',
        },
        children: [
          {
            type: 'text',
            element: 'span',
            content: `$t:admin.welcome.pulse.${cell.key}.where`,
          },
        ],
      },
    ],
  }) as PageComponent

/**
 * The strip, and the sentence above it that says what it is anchored on.
 *
 * "Since this instance started" is exact rather than approximate:
 * `AdminAttentionResponse.since` IS the process boot, byte-identical to
 * `GET /api/admin/config/version`.`startedAt`. Two of the six cells are events
 * counted from it; the other four report what is true now. There is deliberately
 * no since-last-visit delta — that would need per-operator state the console
 * does not keep, and a strip whose numbers changed per reader is a strip two
 * operators cannot discuss.
 */
const pulse: PageComponent = {
  type: 'container',
  element: 'section',
  props: { className: 'flex flex-col gap-2', 'aria-label': '$t:admin.welcome.pulse.region' },
  children: [
    {
      type: 'text',
      element: 'h2',
      props: { className: 'text-foreground-muted text-xs font-medium tracking-wide uppercase' },
      content: '$t:admin.welcome.pulse.heading',
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className:
          'border-border bg-background-raised divide-border grid grid-cols-1 divide-y overflow-hidden rounded-md border sm:grid-cols-2 sm:divide-x lg:grid-cols-3 xl:grid-cols-6',
        'data-testid': 'welcome-pulse',
      },
      children: PULSE_CELLS.map(pulseCellNode),
    },
  ],
} as PageComponent

// ──────────────────────────────────────────────────────────── the nine tiles

/**
 * One declaration-family tile: a head count and the composition behind it.
 *
 * The `kpi` IS the tile — it draws its own bordered card with the label above
 * the value, which is the shape the canvas draws. The sub-line cannot go inside
 * it: `kpi` has no sub-line slot (its `trend` is a static literal percentage,
 * not a binding) and it drops `props` entirely, so no class or marker reaches
 * the mounted DOM. It therefore sits UNDER the card as a caption, which is the
 * one honest degradation on this page.
 *
 * `sub` is `undefined` where the endpoint set carries no composition for that
 * family. Pages and Forms have none; the canvas drew "declared" and
 * "quote-request public", the first of which says nothing and the second of
 * which is a name no reduction yields.
 */
interface CountTile {
  readonly key: string
  readonly label: string
  readonly endpoint: string
  readonly valuePath: string
  readonly sub?: string
}

const COUNT_TILES: readonly CountTile[] = [
  { key: 'pages', label: 'Pages', endpoint: CONFIG_REFLECTION_ENDPOINT, valuePath: 'pageCount' },
  {
    key: 'tables',
    label: 'Tables',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'tableCount',
    sub: '$record.tableFields fields',
  },
  {
    key: 'automations',
    label: 'Automations',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'automationCount',
    sub: '$record.automationsPaused paused · $record.automationsDisabled disabled',
  },
  {
    key: 'agents',
    label: 'Agents',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'agentCount',
    sub: '$record.agentsDefault default',
  },
  {
    key: 'buckets',
    label: 'Buckets',
    endpoint: CONFIG_REFLECTION_ENDPOINT,
    valuePath: 'bucketCount',
    sub: '$record.bucketsS3 s3 · $record.bucketsLocal local',
  },
  { key: 'forms', label: 'Forms', endpoint: CONFIG_REFLECTION_ENDPOINT, valuePath: 'formCount' },
  {
    key: 'links',
    label: 'Links',
    endpoint: LINKS_ENDPOINT,
    valuePath: 'total',
    sub: '$record.linksConfig config · $record.linksDb db',
  },
  {
    key: 'users',
    label: 'Users',
    endpoint: OVERVIEW_ENDPOINT,
    valuePath: 'users.total',
    sub: '$record.usersBanned banned',
  },
  {
    key: 'roles',
    label: 'Roles',
    endpoint: ADMIN_ROLES_ENDPOINT,
    valuePath: 'total',
    sub: '$record.teams teams',
  },
]

const countTileNode = (tile: CountTile): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-col gap-1', 'data-testid': `welcome-tile-${tile.key}` },
    children: [
      {
        type: 'kpi',
        // A literal, not a `$t:` token: a `kpi` is a lazy island whose schema
        // fields ship to the browser as raw props, and a translation key left
        // unresolved there prints as the key.
        label: tile.label,
        dataSource: { system: { endpoint: tile.endpoint, valuePath: tile.valuePath } },
        kpiFormat: { type: 'number' },
      },
      ...(tile.sub === undefined
        ? []
        : [
            {
              type: 'text',
              element: 'span',
              // NOT `truncate`. The widest sub-line ("0 paused · 0 disabled")
              // does not fit a ninth of 1440px, and a tile that ends in `0
              // dis…` has spent a line saying nothing. Wrapping costs a second
              // line under ONE tile and keeps the word.
              props: { className: 'text-foreground-subtle px-3.5 text-xs' },
              content: tile.sub,
            },
          ]),
    ],
  }) as PageComponent

const counts: PageComponent = {
  type: 'container',
  element: 'section',
  props: { className: 'flex flex-col gap-2 pb-2', 'aria-label': '$t:admin.welcome.counts.region' },
  children: [
    {
      type: 'text',
      element: 'h2',
      props: { className: 'text-foreground-muted text-xs font-medium tracking-wide uppercase' },
      content: '$t:admin.welcome.counts.heading',
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9',
        'data-testid': 'welcome-counts',
      },
      children: COUNT_TILES.map(countTileNode),
    },
  ],
} as PageComponent

// ─────────────────────────────────────────── the bar facts, and why there are none
//
// The canvas draws an instance line in the chrome bar:
// `<app> v<ver> (Sovrium v<engine>) · <dialect> · booted <date> <time>`.
// It is NOT shipped here, and each of the three reasons was measured on this
// branch rather than assumed.
//
//  - The app-and-engine half belongs to the SIDEBAR, and it has SHIPPED there.
//    The identity row reads `<app> v<ver> (Sovrium v$app.engineVersion)` under
//    the founder's operator-chrome rule; the console-keys wave landed it, and
//    `$app.engineVersion` joined the closed app-var set to make it sayable.
//    That binding is therefore already spent ON THIS PAGE, in the sidebar head,
//    two hundred pixels from a breadcrumb root that names the app again. Reusing
//    it in the chrome bar would print one fact three ways on one screen. A
//    binding existing is a reason not to invent a second one; it is not a reason
//    for every surface to say the thing again.
//  - It would misprint anyway. `$app.version` resolves to `''` for an app that
//    declares no version — deliberately, so nothing mistakes an unsubstituted
//    token for a build — so `v$app.version` inside one `content` string renders
//    a bare `v`. The sidebar chip solves that with `empty:hidden` on its own
//    element; a single text node has no half to hide. Measured live on
//    `apps/website`, which declares none: `Sovrium Website v (Sovrium v0.24.0)`.
//  - The two tails are unreachable. The dialect (`sqlite` / `postgres`) lives on
//    `GET /api/admin/config/version`, and this page has ONE record, spent on the
//    pulse. The boot instant IS in that record — `$record.since` is the same
//    timestamp — but only as a raw ISO string, and no config primitive formats a
//    bound date: `booted 2026-09-16T13:53:39.631Z` would spend the widest part
//    of the chrome on machine punctuation. The strip says it in words instead.

export default withShell({
  id: 'dashboard-overview',
  name: 'dashboard-overview',
  path: '/',
  meta: {
    title: '$t:admin.meta.welcome',
    // Stated rather than inferred. `languages.default` is the CODE `en`, and
    // it sits ahead of the renderer's `en-US` fallback — so leaving this off
    // would silently move `<html lang>` from `en-US` to `en`.
    lang: 'en-US',
  },
  // The page RECORD. Every `$record.*` above resolves from this one read,
  // server-side, with no island.
  dataSource: { system: { endpoint: ATTENTION_ENDPOINT } },
  components: [hero, pulse, counts],
} as PageConfig) satisfies PageConfig
