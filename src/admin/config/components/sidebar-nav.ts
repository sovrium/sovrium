/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The sidebar's navigation: Overview, then six groups named for what the
// operator watches (Activity, Data, People, Audience, Developers, Design),
// which the console shell (`console-shell.ts`, installed from the library's
// `console-shell` block) takes as its sidebar's `groups` binding.

import { ATTENTION_ENDPOINT, DESIGN_USAGE_ENDPOINT } from '../system-sources'

/**
 * One Application destination: a link that is also a disclosure over the objects
 * it contains.
 *
 * `activeMatch: 'prefix'` is what keeps the parent row marked while the reader
 * is inside one of its objects — `/records` stays current at
 * `/records/contacts`. The default (`exact`) would drop the mark the moment
 * anyone drilled in, which is the failure a section row exists to prevent.
 *
 * ─── THESE FOUR STAY LINKS, AND THAT IS A MEASURED EXCEPTION ──────────────
 *
 * The `Design` row below is a pure TOGGLE now — no `href`, no destination, one
 * control per row — and the case for doing the same here is real: `/records`
 * renders no chooser. It renders the FIRST table's grid under a breadcrumb
 * naming that table, beneath an intro sentence telling the reader to "choose a
 * table to open its grid", and `/submissions`, `/files` and `/conversations` each do the
 * same with their own first object. Clicking the label costs a full page load
 * to arrive at a duplicate of the disclosure's own first child.
 *
 * It was converted anyway, measured, and REVERTED. Dropping `href` here takes
 * the navigation's answer to "where am I" with it, and the renderer says why in
 * as many words: *"A FETCHED disclosure has no children to test at render time,
 * so its section is current only when the entry's own `activeMatch` says so"*
 * (`render/resolve/sidebar-current-resolver.ts`). The `Design` row survives
 * because its children are AUTHORED and the server can see that one of them is
 * the current page; a `source` list does not exist until the reader expands it.
 *
 * Measured on `/tables/journey_subscribers`, `/forms/journey` and
 * `/buckets/system`, same host, one regeneration apart:
 *
 *   | `href` | parent           | children rendered | `aria-current` |
 *   |--------|------------------|-------------------|----------------|
 *   | kept   | `a`              | yes               | on the child   |
 *   | gone   | `button`, closed | NONE              | NOWHERE        |
 *
 * So the choice is a duplicate destination against a sidebar that cannot say
 * which object is open when someone follows a deep link into one — and the
 * second is the worse console. The tidier row is worth having and is NOT
 * authorable today; closing it needs the fetched disclosure's section to
 * resolve from a declared prefix rather than from its own `href` (the
 * predicate `showWhen.section` already uses), which is routed rather than
 * worked around here.
 *
 * The three state labels are left to their defaults; the schema ships the
 * console's own wording (`Loading…`, `Couldn't load the list.`, `No items.`)
 * precisely so this conversion needed no per-entry copy.
 *
 * @param key - the `/{key}` route segment and the `data-nav-{key}` testid stem.
 * @param label - the row's English label.
 * @param icon - the Lucide name; geometry is resolved server-side.
 * @param endpoint - the admin read endpoint listing this destination's objects.
 * @param rowsKey - the array key inside that endpoint's envelope.
 * @param labelKey - the row key a child reads its text from; `name` unless the
 *   endpoint carries a human label beside the identifier (tables do). The href
 *   and the testid keep `{name}` either way.
 */
const objectSection = (
  key: string,
  label: string,
  icon: string,
  endpoint: string,
  rowsKey: string,
  labelKey = 'name'
): Readonly<Record<string, unknown>> => ({
  label,
  href: `/${key}`,
  icon,
  activeMatch: 'prefix',
  props: { 'data-testid': `data-nav-${key}` },
  childrenProps: { 'data-testid': `${key}-nav-children` },
  source: {
    endpoint,
    rowsKey,
    labelKey,
    hrefTemplate: `/${key}/{name}`,
    itemProps: { 'data-testid': `data-nav-${key}-{name}` },
  },
})

/**
 * One flat System destination.
 *
 * `prefix` here too, for the same reason: `/users/42` is still Users. A row
 * whose destination has no sub-paths is unaffected by the choice, so the whole
 * list is spelled one way rather than audited row by row.
 */
const systemRow = (
  key: string,
  label: string,
  icon: string
): Readonly<Record<string, unknown>> => ({
  label,
  href: `/${key}`,
  icon,
  activeMatch: 'prefix',
  props: { 'data-testid': `data-nav-${key}` },
})

/**
 * A count of things gone wrong, read from the attention envelope.
 *
 * `destructive`, so the count is painted as damage AND a folded group holding a
 * non-zero one opens on arrival: a failure is never tucked away behind a
 * heading. Every badge reads the SAME endpoint, which the badge hook fetches
 * once however many rows name it.
 *
 * @param valuePath - the attention field counting this row's failures.
 */
const failureBadge = (valuePath: string): Readonly<Record<string, unknown>> => ({
  badge: { endpoint: ATTENTION_ENDPOINT, valuePath, variant: 'destructive' },
})

/**
 * The six pages of the design-system console, authored rather than fetched.
 *
 * Six since `/design-system/agents` was retired into the Overview's own
 * `Share and export` section. A row here pointing at it would be a link into a
 * 404 from the one place a reader navigates the section.
 *
 * They are a KNOWN, fixed set, so `children` is right and `source` would be
 * wrong: a declared list has no loading, error or empty state to inherit, and
 * the row never depends on an endpoint being up.
 *
 * `overview` points at the section ROOT (`/design-system`), not at
 * `/design-system/overview` — the root IS the overview page. Its `exact` match
 * (the default) is what stops it marking itself current on all six siblings.
 *
 * Five rows now: the UI kit is gone. It documented the engine's component
 * catalogue, which is shadcn's and ships in `sovrium docs`, and it never showed
 * anything specific to the operator's app.
 */
/** One row of the Design group, with the live count the two catalogues carry. */
interface DesignSystemRow {
  readonly key: string
  readonly label: string
  readonly href: string
  /** A live count beside the row, for the two rows that index something. */
  readonly badge?: { readonly endpoint: string; readonly valuePath: string }
}

const DESIGN_SYSTEM_ROWS: readonly DesignSystemRow[] = [
  { key: 'overview', label: '$t:admin.nav.design.overview', href: '/design-system' },
  {
    key: 'foundations',
    label: '$t:admin.nav.design.foundations',
    href: '/design-system/foundations',
  },
  // ─── THE TWO COUNTS, AND WHY THEY ARE HERE NOW ───────────────────────────
  //
  // These rows sit inside the `Design` DISCLOSURE, and `toIslandChild`
  // (`src/presentation/render/registry/sidebar-entry.tsx`)
  // used to project a disclosure's children WITHOUT `badge`, on the server,
  // before either render saw it — so a badge declared here was accepted, stored
  // and silently inert. It travels now, which is what these two waited on.
  //
  // The Components count carries its own query string. `endpoint` is validated
  // as "a path starting with /" and nothing more, so the narrowing rides in the
  // path rather than in a `query` field the badge source does not have.
  {
    key: 'components',
    label: '$t:admin.nav.design.components',
    href: '/design-system/components',
    badge: { endpoint: `${DESIGN_USAGE_ENDPOINT}?subject=component`, valuePath: 'total' },
  },
  { key: 'brand', label: '$t:admin.nav.design.brand', href: '/design-system/brand' },
  { key: 'voice', label: '$t:admin.nav.design.voice', href: '/design-system/voice' },
]

// ONE row per destination, no third level. The kit's own categories used to open
// here, scoped by `showWhen` to the pages inside it — a navigation split in two,
// half in the chrome and half on the page. They are the page's own column now
// (`config/pages/design-system/kit-nav.ts`).
const designSystemChildren: readonly Record<string, unknown>[] = DESIGN_SYSTEM_ROWS.map(
  ({ key, label, href, badge }) => ({
    label,
    href,
    props: { 'data-testid': `data-nav-design-system-${key}` },
    ...(badge === undefined ? {} : { badge }),
  })
)

/**
 * The navigation itself.
 *
 * `trackNavigation` is what makes this correct under the SPA content swap. The
 * sidebar lives OUTSIDE `#admin-surface-content`, so it is not re-rendered when
 * the console swaps a surface — and a server-resolved `aria-current` would then
 * be frozen on the page the reader has already left. The `sidebar-current`
 * island re-derives it from `window.location` on `sovrium:navigated` and on
 * `popstate`.
 *
 * ─── GROUPED BY WHAT THE OPERATOR WATCHES ──────────────────────────────────
 *
 * Overview, unlabelled, then six groups read top to bottom in the order someone
 * who did not choose to be here needs them: ACTIVITY (what moved since last
 * time and may need a hand), DATA (what the app stores), PEOPLE (who can get
 * in and what they reach), AUDIENCE (what the app serves outward and who reads
 * it), DEVELOPERS (how other programs reach the app, and the instance's own
 * facts), DESIGN (what the `design` key produced).
 *
 * The previous split — System, Application, Developers — grouped by where a
 * thing lives in Sovrium's head: Users sat beside Decisions and Design, Runs
 * beside Templates.
 *
 * ─── A ROW EXISTS ONLY WHEN THE APP DECLARES ITS FEATURE ───────────────────
 *
 * Each row's page carries a `requires` naming the config that makes it mean
 * something (Runs ⇐ `automations`, Records ⇐ `tables`, and so on). An unmet
 * page is not registered, so it 404s — and its row is dropped with it, so a
 * group whose every row is gone draws no heading. One declaration decides
 * both, so the navigation can never offer a page the instance refuses.
 *
 * ─── ONE LANDMARK ──────────────────────────────────────────────────────────
 *
 * Every labelled group names the same landmark, and the renderer folds a
 * contiguous run of groups sharing one into a single `nav`. Six landmarks,
 * one per group, would make a screen reader's landmark list longer than the
 * sidebar it describes.
 */
const LANDMARK = '$t:admin.nav.landmark.console'

/** One labelled group of the sidebar. */
const group = (
  key: string,
  items: readonly Readonly<Record<string, unknown>>[]
): Readonly<Record<string, unknown>> => ({
  label: `$t:admin.nav.group.${key}`,
  landmark: LANDMARK,
  headingLevel: 2,
  // Folded until it matters: open while it holds the current page or a
  // non-zero failure count, shut otherwise. Seven groups all open would push
  // the bottom of the list below the fold on a laptop.
  collapsible: true,
  items,
})

export const consoleNavGroups: readonly Readonly<Record<string, unknown>>[] = [
  // ─── THE HOME ROW, AND WHY IT IS A GROUP WITH NO NAME ────────────────────
  //
  // Overview is the way back OUT of every section, and the way out of the
  // sections is not itself a section. A group with no `label` contributes
  // neither a heading nor a landmark: its entries render into the navigation
  // root, above the first named group.
  //
  // `activeMatch: 'exact'` because this row's href is `/`, and `prefix` would
  // make the console's root a prefix of every console route.
  //
  // The testid stays `data-nav-overview`: a testid is an ADDRESS.
  {
    items: [
      {
        label: '$t:admin.nav.overview',
        href: '/',
        icon: 'house',
        activeMatch: 'exact',
        props: { 'data-testid': 'data-nav-overview' },
      },
    ],
  },
  group('activity', [
    // The run history first; the automation catalogue is its second tab.
    { ...systemRow('runs', '$t:admin.crumb.runs', 'zap'), ...failureBadge('failedRuns') },
    objectSection(
      'submissions',
      '$t:admin.crumb.submissions',
      'clipboard-list',
      '/api/admin/forms',
      'items'
    ),
    objectSection(
      'conversations',
      '$t:admin.crumb.conversations',
      'message-square',
      '/api/admin/agents',
      'items'
    ),
  ]),
  group('data', [
    objectSection(
      'records',
      '$t:admin.crumb.records',
      'table',
      '/api/admin/tables/overview',
      'by_table',
      'label'
    ),
    objectSection('files', '$t:admin.crumb.files', 'folder', '/api/admin/buckets', 'items'),
  ]),
  group('people', [
    systemRow('users', '$t:admin.crumb.users', 'users'),
    // Who can reach what: the access lenses, with their findings drawn in
    // amber inside each lens rather than on a tab of their own.
    systemRow('organisation', '$t:admin.crumb.organisation', 'network'),
  ]),
  group('audience', [
    // Pages, with Footprint as its second tab — or Footprint alone, on an app
    // that serves no page of its own.
    // Analytics reads answer only an admin-equivalent caller; the entry asks
    // the same question, so a read-only operator is never offered a 404.
    {
      ...systemRow('analytics', '$t:admin.crumb.analytics', 'chart-column'),
      capability: 'administer-accounts',
    },
    systemRow('links', '$t:admin.crumb.links', 'link'),
    // Flat, not an object section: an asset path has slashes in it, and the
    // derived children's `{name}` href template has one slot for one segment.
    systemRow('templates', '$t:admin.crumb.templates', 'file-text'),
  ]),
  group('developers', [
    {
      label: '$t:admin.crumb.api',
      href: '/api',
      icon: 'code',
      props: { 'data-testid': 'developer-nav-api' },
    },
    {
      label: '$t:admin.crumb.mcp',
      href: '/mcp',
      icon: 'bot',
      props: { 'data-testid': 'developer-nav-mcp' },
    },
    // Out of the account menu: it exists only when `auth.apiKeys` is declared,
    // and an operator looks for it beside the API page.
    systemRow('api-keys', '$t:admin.crumb.apiKeys', 'key-round'),
    {
      ...systemRow('connections', '$t:admin.crumb.connections', 'plug'),
      ...failureBadge('tokensExpired'),
    },
    {
      label: '$t:admin.crumb.env',
      href: '/env',
      icon: 'braces',
      props: { 'data-testid': 'developer-nav-env' },
      ...failureBadge('variablesUnset'),
    },
    {
      label: '$t:admin.crumb.changelog',
      href: '/changelog',
      icon: 'history',
      props: { 'data-testid': 'developer-nav-changelog' },
    },
    // `prefix`, so `/decisions/[internal ref]` still marks Decisions current.
    systemRow('decisions', '$t:admin.crumb.decisions', 'scroll-text'),
  ]),
  group('design', [
    // A TOGGLE: no `href`. `/design-system` is the section's overview and the
    // list's first child already links to it, so the label would offer the
    // same page twice. The children are AUTHORED, so the server still sees
    // which one is current and opens the disclosure on arrival.
    {
      label: '$t:admin.nav.designSystem',
      icon: 'palette',
      props: { 'data-testid': 'data-nav-design-system' },
      childrenProps: { 'data-testid': 'design-system-nav-children' },
      children: designSystemChildren,
    },
  ]),
]
