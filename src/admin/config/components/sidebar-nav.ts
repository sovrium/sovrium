/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The sidebar's navigation: the Application rows, the System rows and the
// Design disclosure, composed into the one `sidebar` node the `aside` hosts
// (see `sidebar.ts`).

import { COMPONENT_TYPES_ENDPOINT, DESIGN_USAGE_ENDPOINT } from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * One Application destination: a link that is also a disclosure over the objects
 * it contains.
 *
 * `activeMatch: 'prefix'` is what keeps the parent row marked while the reader
 * is inside one of its objects — `/tables` stays current at
 * `/tables/contacts`. The default (`exact`) would drop the mark the moment
 * anyone drilled in, which is the failure a section row exists to prevent.
 *
 * ─── THESE FOUR STAY LINKS, AND THAT IS A MEASURED EXCEPTION ──────────────
 *
 * The `Design` row below is a pure TOGGLE now — no `href`, no destination, one
 * control per row — and the case for doing the same here is real: `/tables`
 * renders no chooser. It renders the FIRST table's grid under a breadcrumb
 * naming that table, beneath an intro sentence telling the reader to "choose a
 * table to open its grid", and `/forms`, `/buckets` and `/agents` each do the
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
 */
const objectSection = (
  key: string,
  label: string,
  icon: string,
  endpoint: string,
  rowsKey: string
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
    labelKey: 'name',
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
 * ONE of the six holds a list of its own: `ui-kit` opens into
 * {@link kitCategoryChildren} while a kit page is being read.
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
    key: 'ui-kit',
    label: '$t:admin.nav.design.uiKit',
    href: '/design-system/ui-kit',
    badge: { endpoint: COMPONENT_TYPES_ENDPOINT, valuePath: 'total' },
  },
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
 * Two groups share the `Data` landmark and are listed TOGETHER: the renderer
 * folds a CONTIGUOUS run of groups into one `nav`, so separating them would
 * silently produce two landmarks both named "Data".
 *
 * ─── THREE GROUPS: SYSTEM · APPLICATION · DEVELOPERS ───────────────────────
 *
 * The order answers the question an operator arrives with, and it is not the
 * order the rows were built in. SYSTEM is the instance — who runs it, what it
 * is doing, what it costs, what it looks like. APPLICATION is the operator's
 * own material — the records, submissions, files and conversations their app
 * holds, plus the runs and links that move them. DEVELOPERS is everything
 * addressed by a machine rather than by a person.
 *
 * Four moves landed here, and each was a row filed under the wrong question:
 *
 *   - the `Overview` group is GONE. It was a heading over a single row, and
 *     that row is the instance's own front page — which is what SYSTEM means.
 *     It leads that group instead. The group emitted a `navigation` landmark
 *     named "Overview" (a group is named by its label when it declares no
 *     `landmark`), so the console now publishes three navigations rather than
 *     four; the three NAMES are unchanged, which is what `BRAND.md` §10 and
 *     the specs hold.
 *   - `Automations` is `Runs`, and moved to APPLICATION. What an operator
 *     opens it for is the run history — did it fire, did it fail — which is
 *     their material, not the engine's. The catalogue they pause from is one
 *     view inside that, and becomes its second tab next wave.
 *   - `Connections` moved to DEVELOPERS, beside API and MCP: an OAuth token to
 *     a third-party service is an integration, not a person or a record.
 *   - `Links` moved to APPLICATION for the reason Records is there — a short
 *     link is something the app serves.
 *
 * `Footprint` stays a SYSTEM row for one more wave. It becomes the second tab
 * of Analytics next, and `redirects[]` does nothing under the mount, so
 * retiring the route early would make that URL simply stop existing.
 */
export const consoleNav: PageComponent = {
  type: 'sidebar',
  trackNavigation: true,
  // ─── THE RAIL, AND WHY THE BREAKPOINT IS `xl` ────────────────────────────
  //
  // Read as a STRICT LOWER BOUND: the rail applies at every width BELOW the
  // named breakpoint. The console is asked for a rail on a laptop and a full
  // sidebar on a wide desktop, so the breakpoint is the one at which the
  // DESKTOP starts (`xl`, 1280px) and not the one at which the laptop does —
  // naming `lg` would leave 1024 full and rail only the widths where the
  // drawer has already taken the sidebar away.
  //
  // It composes with the `md` drawer on the frame rather than replacing it:
  // below `md` the aside leaves the layout behind the burger, and between
  // `md` and `xl` it is present as 56px of glyphs.
  //
  // `max-xl:w-full` is not decoration. The rail's own box class is
  // `max-xl:w-14` — 56px, the width of the FRAME — and this element is inside
  // that frame, past its padding, where 56px overflows a 36px content box that
  // the frame then clips. The frame carries the width; this fills whatever the
  // frame leaves.
  rail: { below: 'xl' },
  props: {
    className:
      // The `button` counter-rules are NOT decoration and not symmetry: since a
      // top-level entry may omit its `href`, the rail's own rules cover BOTH
      // element types — the emitted className carries
      // `max-xl:[&_button]:justify-center max-xl:[&_button>span]:sr-only`
      // beside the `a` pair. The `Design` row is the console's one such entry,
      // so with only the anchor counter-rules its label stayed `sr-only`
      // INSIDE the 256px phone drawer: measured at 375 with the drawer open,
      // the label span was 1x1 while every sibling link's was full width — a
      // rail-shaped row in a drawer that is not a rail.
      'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto max-xl:w-full max-md:[&_a]:justify-start max-md:[&_a>span]:not-sr-only max-md:[&_button]:justify-start max-md:[&_button>span]:not-sr-only max-md:[&_h2]:not-sr-only',
  },
  groups: [
    // ─── THE HOME ROW, AND WHY IT IS A GROUP WITH NO NAME ────────────────────
    //
    // Welcome is the way back OUT of every section, and the way out of the
    // sections is not itself a section. It used to lead System, under that
    // heading, which filed the console's front page as one more system surface
    // — and a reader cycling landmarks met it inside "Data".
    //
    // A group with no `label` contributes neither a heading nor a landmark: its
    // entries render into the navigation root, above the first named group. So
    // the row sits directly under the search trigger and ahead of the `System`
    // heading, and the console still publishes exactly three navigations.
    //
    // A group rather than a hand-written anchor because everything that makes a
    // row a NAV row lives in the group render: the shared current-entry
    // treatment and its `aria-current`, the rail's own row rules, and the
    // client tracker that re-marks it after an in-app SPA navigation. An
    // `<a>` placed beside the nav would lose all three.
    //
    // `activeMatch: 'exact'` because this row's href is `/`, and `prefix` — the
    // spelling every other row uses — would make the console's root a prefix of
    // every console route and mark Welcome current on all thirty of them.
    //
    // The testid stays `data-nav-overview` although the row no longer says
    // Dashboard and no group is called Overview: a testid is an ADDRESS, and
    // renaming one costs every spec that holds it in exchange for a string no
    // reader ever sees.
    {
      items: [
        {
          label: '$t:admin.nav.welcome',
          href: '/',
          icon: 'house',
          activeMatch: 'exact',
          props: { 'data-testid': 'data-nav-overview' },
        },
      ],
    },
    {
      label: '$t:admin.nav.group.system',
      landmark: '$t:admin.nav.landmark.data',
      headingLevel: 2,
      items: [
        // FIRST in the group, and the position is the argument, as it is for
        // the row that closes it. Every other row here answers "how much of X
        // does this app have?"; this one answers "who can reach it" — the
        // shape rather than the contents, and the question an operator most
        // often arrives with.
        //
        // The `Dashboard` row that used to open this group is gone from here
        // rather than deleted: it is the `Welcome` home row above, outside any
        // group, and it kept its `data-nav-overview` testid across the move.
        systemRow('organisation', '$t:admin.crumb.organisation', 'network'),
        systemRow('users', '$t:admin.crumb.users', 'users'),
        // Analytics answers both halves now — the audience at `?tab=pages` and
        // the instance's footprint at `?tab=footprint`. Footprint had its own
        // row here and its own document; `/footprint` is still a live address,
        // but the sidebar names the QUESTION once rather than offering two rows
        // that lead to two views of the same subject.
        systemRow('pages', '$t:admin.crumb.pages', 'chart-column'),
        // A TOGGLE: no `href`, so the whole row opens and shuts its own list
        // and goes nowhere. It is the ONE disclosure in this sidebar that can
        // be one, and both halves of that are measured.
        //
        // It COSTS nothing, because `/design-system` is the section's overview
        // and the list's first child already links to it under its own name.
        // The row used to offer the same page twice — once on the label, once
        // on `Overview` two pixels below — with only the label taking the
        // current-page fill, so a reader who clicked the label landed on a
        // page they had not asked for and watched the list open underneath as
        // a side effect. `activeMatch` goes with the `href`: a row that is not
        // a page can never be `aria-current`, and the decode refuses it rather
        // than ignoring it.
        //
        // And it LOSES nothing, because these six children are AUTHORED. The
        // server can see that one of them is the current page, so the
        // disclosure still opens on arrival and the current child still takes
        // the mark — verified on `/design-system/brand`: `aria-expanded=true`,
        // six children, `aria-current="page"` on `brand`. The four Application
        // rows fetch their children and therefore cannot do this; see
        // `objectSection` above for the measurement that kept them links.
        {
          label: '$t:admin.nav.design',
          icon: 'palette',
          props: { 'data-testid': 'data-nav-design-system' },
          childrenProps: { 'data-testid': 'design-system-nav-children' },
          children: designSystemChildren,
        },
        // LAST in the group, and that position is the argument: the rows above
        // are what the app IS, and this one is why it is that way. A reader
        // reaches it after the thing it explains, not before.
        //
        // `prefix`, like every other flat System row, so `/decisions/[internal ref]`
        // still marks Decisions current — which is the whole reason the
        // document has no row of its own.
        systemRow('decisions', '$t:admin.crumb.decisions', 'scroll-text'),
      ],
    },
    {
      label: '$t:admin.nav.group.application',
      landmark: '$t:admin.nav.landmark.data',
      headingLevel: 2,
      items: [
        // The ROUTE stays `/automations` while the row, the trail, the heading
        // and the document title all say Runs. A route is an address other
        // things already hold — a bookmark, a link out of an alert — and
        // `redirects[]` does nothing under the mount, so renaming it would
        // break those for a word nobody reads.
        systemRow('automations', '$t:admin.crumb.automations', 'zap'),
        objectSection(
          'tables',
          '$t:admin.crumb.tables',
          'table',
          '/api/admin/tables/overview',
          'by_table'
        ),
        objectSection(
          'forms',
          '$t:admin.crumb.forms',
          'clipboard-list',
          '/api/admin/forms',
          'items'
        ),
        objectSection('buckets', '$t:admin.crumb.buckets', 'folder', '/api/admin/buckets', 'items'),
        // Flat, not an object section: an asset path has slashes in it, and
        // the derived children's `{name}` href template has one slot for one
        // segment. The directory page is the picker.
        systemRow('templates', '$t:admin.crumb.templates', 'file-text'),
        objectSection(
          'agents',
          '$t:admin.crumb.agents',
          'message-square',
          '/api/admin/agents',
          'items'
        ),
        systemRow('links', '$t:admin.crumb.links', 'link'),
      ],
    },
    {
      label: '$t:admin.nav.group.developers',
      landmark: '$t:admin.nav.group.developers',
      headingLevel: 2,
      items: [
        systemRow('connections', '$t:admin.crumb.connections', 'plug'),
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
        {
          label: '$t:admin.crumb.changelog',
          href: '/changelog',
          icon: 'history',
          props: { 'data-testid': 'developer-nav-changelog' },
        },
        {
          label: '$t:admin.crumb.env',
          href: '/env',
          icon: 'settings',
          props: { 'data-testid': 'developer-nav-env' },
        },
      ],
    },
  ],
} as PageComponent
