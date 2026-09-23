/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's persistent sidebar, as config.
//
// ─── WHAT THIS REPLACES ────────────────────────────────────────────────────
//
// A 1,492-line island family under `src/presentation/islands/admin/sidebar/`,
// mounted through a `data-island: 'admin-sidebar'` marker on the shell's aside.
// Everything it did that a reader can observe is expressed below by the generic
// `sidebar` component: named landmarks, headed sections, per-row testids,
// lazily-fetched disclosures, and a client-re-derived current-row mark.
//
// This is the point of the exercise, not a side effect of it. The console is
// Sovrium's own app; a chrome it can only build in TypeScript is a chrome no
// operator's app can build at all. Every gap that forced the island to exist was
// closed as a GENERIC primitive first (`groups[].landmark`, `headingLevel`,
// `items[].props` / `childrenProps` / `source.itemProps`, disclosure over
// `children` XOR `source`, `trackNavigation`), so what is left here is authoring.
//
// ─── HREFS ARE MOUNT-RELATIVE, AND THAT IS LOAD-BEARING ────────────────────
//
// Every `href` and `hrefTemplate` below is written WITHOUT the `/_admin` prefix.
// `prefixMountHrefs` (`src/domain/models/app/admin/mount-hrefs.ts`) walks the decoded config
// and moves each onto the console's base at boot, so `/tables` authored here is
// `/_admin/tables` as served. Writing `/_admin/tables` here would double the
// prefix.
//
// `endpoint` is deliberately NOT in that walk: `/api/admin/*` is mounted once for
// the whole server and is not part of the console's base. So endpoints stay
// absolute and hrefs stay relative — the two spellings are not interchangeable.
//
// ─── THE ORDER OF THE PIECES IS FORCED BY THE RENDERER ─────────────────────
//
// `structural-components.tsx` renders a `sidebar`'s `groups` BEFORE its authored
// `children`, and a `sidebar` is always a `div` (it takes no `element`). So the
// brand header and the search trigger cannot be children of the sidebar node —
// they would land under the nav. They are siblings of it inside the `aside`,
// which is the frame that also carries the drawer markers.

import { COMPONENT_TYPES_ENDPOINT, DESIGN_USAGE_ENDPOINT } from '../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The brand row: a link out to the operator's own site, plus the version chip.
 *
 * `$app.origin` rather than `/`, because this link leaves the console. A `/`
 * here would be rewritten to the mount base by the walk described above and the
 * affordance would silently become "go to the console home" — which the row
 * immediately below it already is.
 *
 * The version chip is OUTSIDE the anchor: it is metadata about the running
 * build, not part of the destination's accessible name.
 *
 * It carries `empty:hidden` because `$app.version` is the ONE app var that
 * always resolves — to `''` when the app declares none, deliberately, so a
 * downstream "no version" fallback never mistakes an unsubstituted token for a
 * real version (`app-vars.ts`). This console declares none, so without the
 * variant the row ends in a 16x4 grey pill containing nothing: a chip that
 * says a build is running and does not say which.
 *
 * ─── THE `v` IS A `::before`, AND THAT IS WHY IT IS NOT IN THE CONTENT ─────
 *
 * The founder rule for operator-facing chrome spells a build `v<ver>`, not a
 * bare number: a lone `1.4.2` beside a name is a number, and `v1.4.2` is a
 * version. But `empty:hidden` matches on the element being EMPTY, and `:empty`
 * is decided by child NODES — so moving the `v` into `content` would fill the
 * chip, and an app declaring no version would render a pill saying just `v`.
 * A `::before` is not a child node, so the chip still collapses when there is
 * nothing to qualify and the `v` appears only beside a real build.
 *
 * ─── THE ENGINE HALF, AND THE ONE THING THAT MADE IT SAYABLE ──────────────
 *
 * The rule's full form is `<app> v<ver> (Sovrium v<engine>)` — the app as the
 * subject, the engine as the qualifier, in that order. The app is the row
 * above; the engine is the line below it.
 *
 * It could not be written until `$app.engineVersion` joined the closed app-var
 * set. The three sources that existed before were each measured and each
 * refused: `$app.version` is the SERVING app's version, which under a mount is
 * the OPERATOR's and would print their number inside Sovrium's parentheses;
 * `GET /api/admin/instance` reports that same number; and
 * `GET /api/admin/config/version` is the real engine read that no shell surface
 * can bind, because a page binds ONE system record while this sidebar belongs
 * to all thirty-odd of them — a `kpi` pointed at it would draw a "Loading KPI"
 * skeleton in the sidebar head of every full page load.
 *
 * ─── WHY A SECOND LINE RATHER THAN A SECOND CHIP ──────────────────────────
 *
 * Read as one sentence the rule is inline, and inline is what does not fit: at
 * 256px the head has ~224px of content, and the app name at `text-md`
 * semibold plus a build chip already claims most of it. A third item on that
 * row wins its space by truncating the app's NAME, which is the one word in
 * the head that has to survive.
 *
 * So the sentence wraps rather than shrinking, and the parentheses are what
 * make the second line legible as a continuation of the first rather than as a
 * second fact. Order is preserved, which is the half of the rule that carries
 * meaning: a head naming the engine first tells an operator the wrong thing
 * about whose console they are looking at.
 *
 * It does NOT collapse the way the chip above does, and that asymmetry is
 * correct. `version` answers `''` for an app that legitimately declares none;
 * the engine always has one — `getSovriumVersion()` falls back rather than
 * throwing — so an absent value here can only mean the render was not threaded
 * it, and the surviving `$app.engineVersion` literal is the loud signal that
 * says so. Blanking it would ship `(Sovrium v)` to an operator instead.
 *
 * ─── THE MONOGRAM SQUARE IS GONE, AND IT IS A GENUINE LOSS ─────────────────
 *
 * The island drew a 28px square holding the FIRST LETTER of the app label,
 * upper-cased. No `$app.*` name yields it — the closed set is `name`, `label`,
 * `version`, `origin`, `basePath` (`src/domain/models/app/pages/app-vars.ts`) — and no
 * component can derive one from a bound value: there is no `initials` or
 * `firstLetter` transform anywhere in the config surface, and there cannot be a
 * literal here because the label is the OPERATOR's, unknown when this file is
 * written. Clipping `$app.label` inside a fixed box was tried and rejected: it
 * renders a truncated word, not a monogram.
 *
 * The missing GENERAL feature is a derived form of a bound value — any app
 * drawing an avatar or a compact brand mark from a name needs it, and none can
 * today. Nothing asserts the square, so it is dropped rather than faked.
 */
const brandHeader: PageComponent = {
  type: 'container',
  element: 'div',
  // ─── THE WHOLE ROW GOES UNDER THE RAIL, AND THAT IS THE DRAWING ──────────
  //
  // The reference board's rail head is a 36px square holding the app's
  // MONOGRAM — a mark, not a link: it drops the name, drops the version chip,
  // and is not an anchor at all. The console cannot draw that mark. No
  // `$app.*` name yields an initial and no component derives one from a bound
  // value ([internal ref]a measured the closed set), and clipping `$app.label` inside
  // a fixed box renders a truncated word rather than a monogram.
  //
  // So the choice under 56px is an EMPTY square or no square, and no square is
  // the one the drawing agrees with. The cost is named rather than hidden: the
  // "open the site" affordance is unreachable between `md` and `xl`, and comes
  // back with the full sidebar. It returns the moment a derived-initial
  // primitive exists — which is the gap already routed, not a new one.
  props: { className: 'flex flex-col gap-0.5 md:max-xl:hidden' },
  children: [
    {
      // The app's own line: its name, and which build of it is running.
      type: 'container',
      element: 'div',
      props: { className: 'flex items-center gap-2' },
      children: [
        {
          type: 'link',
          props: {
            href: '$app.origin',
            target: '_blank',
            rel: 'noopener',
            'aria-label': '$t:admin.shell.openSite',
            className: 'flex min-w-0 flex-1 items-center gap-2',
          },
          children: [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground truncate text-md font-semibold' },
              content: '$app.label',
            },
          ],
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              "bg-background-subtle text-foreground-subtle shrink-0 rounded-full px-2 py-0.5 font-mono text-xs leading-[1.3] before:content-['v'] empty:hidden!",
            'data-testid': 'sidebar-version',
          },
          content: '$app.version',
        },
      ],
    },
    {
      // The engine's line, under the app's — the qualifier of the sentence
      // above rather than a second heading, so it is quiet, monospaced like
      // every other version in this console, and truncates rather than wraps.
      //
      // NOT inside the version chip: `-020` reads that chip's text as exactly
      // the app's version, and folding two numbers into one pill would say
      // neither. Its own `data-testid` is an address for a later assertion; the
      // criterion itself is read off the head's TEXT, because what it claims is
      // what an operator reads and in what order.
      type: 'text',
      element: 'p',
      props: {
        className: 'text-foreground-subtle truncate font-mono text-xs leading-[1.3]',
        'data-testid': 'sidebar-engine',
      },
      content: '(Sovrium v$app.engineVersion)',
    },
  ],
} as PageComponent

/**
 * The palette trigger.
 *
 * The hook is `data-command-palette-trigger`, never the accessible name:
 * `CommandPaletteCapture` delegates from `document` on
 * `closest('[data-command-palette-trigger]')`, so the control keeps working
 * before the palette island hydrates AND after the label is translated.
 *
 * ─── IT HAS TO NAME A VARIANT, AND THAT IS NOT COSMETIC ────────────────────
 *
 * A `button` with no `variant` gets `default`, which is the PRIMARY tone: a
 * near-black fill. This row spent months rendering as a black slab with
 * subtle-grey placeholder text on it — 1.9:1, effectively unreadable — because
 * the className carried a border and a text tone but no fill, so the recipe's
 * own `bg-primary` came through underneath. `secondary` is the raised, bordered
 * surface the reference draws, and the className then only has to correct the
 * geometry: a search field is 36px and softly bordered where a button is 32px
 * and firmly so.
 */
const searchTrigger: PageComponent = {
  type: 'button',
  variant: 'secondary',
  props: {
    type: 'button',
    'aria-label': '$t:admin.shell.search',
    'data-command-palette-trigger': 'true',
    className:
      'border-border text-foreground-subtle hover:text-foreground flex h-9 w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-md font-normal md:max-xl:w-9 md:max-xl:justify-center md:max-xl:px-0',
  },
  children: [
    // The magnifier is drawn at EVERY width, which is both what the reference
    // board draws beside the wide placeholder and the only shape available:
    // an `icon` carries an inline `display:inline-block` from the contentless-
    // placeholder rule (`render/props/props-builder.ts`), and an inline style
    // beats every class-based display utility — so `hidden` / `max-xl:block`
    // on an icon, or on a container wrapping one, cannot switch it. `image`
    // has a carve-out from that rule for exactly this reason; `icon` does not.
    // Routed as a platform gap.
    //
    // Under the rail the two captions go and the button becomes a 36px square,
    // so the glyph is what is left to name the control.
    { type: 'icon', props: { name: 'search', size: 16, className: 'shrink-0' } },
    {
      type: 'text',
      element: 'span',
      props: { className: 'flex-1 text-left max-xl:hidden' },
      content: '$t:admin.shell.searchPlaceholder',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-foreground-subtle text-sm max-xl:hidden' },
      content: '⌘K',
    },
  ],
} as PageComponent

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
 * `/buckets/default`, same host, one regeneration apart:
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
const consoleNav: PageComponent = {
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

/**
 * The operator identity footer.
 *
 * ─── THE TRIGGER NAMES ITS HOLDER, AND IS ANNOUNCED BY ITS FUNCTION ────────
 *
 * Two different names, deliberately. `triggerLabel` is the ACCESSIBLE name and
 * stays a verb — a control announced as a person tells a screen-reader user who
 * they are rather than what the control does. The children are what a sighted
 * reader sees: their picture, their name, their address.
 *
 * ─── NOTHING HERE IS IN THE SERVED BYTES ───────────────────────────────────
 *
 * Every value is a `$session.` binding resolved CLIENT-SIDE from
 * `GET /api/auth/get-session`. The server draws an unresolved token as an
 * ABSENCE rather than as text, which is the half that matters: a token left in
 * visible copy is merely ugly, while the same token in `src` is fetched as a
 * relative URL and painted as a broken image — and an identity in the served
 * bytes would let a cached page serve one caller's name to the next.
 *
 * The avatar's chain is ordered and that is the feature: a picture if the
 * account has one, the caller's own initials from `$session.name` if it does
 * not. An operator who never uploaded a photograph gets a readable disc rather
 * than a broken one, without this file writing the fallback.
 *
 * The build-version line the island drew in the menu FOOTER is still gone, for
 * a reason that has not changed: `dropdown-menu` has no `footerContent`. The
 * chip beside the brand already prints `$app.version`.
 */
const operatorMenu: PageComponent = {
  type: 'dropdown-menu',
  triggerLabel: '$t:admin.shell.account',
  props: {
    // `md:max-xl:[&>svg]:hidden` drops the chevron under the rail, which is
    // what the reference board draws: at 56px the row is the avatar and
    // nothing else, centred. The chevron is the affordance for a label it no
    // longer sits beside, so at that width it is decoration in the only place
    // with no room for any — and it is `aria-hidden`, so hiding it visually
    // costs a screen reader nothing. The trigger keeps its accessible name
    // from `triggerLabel`.
    //
    // It has to be an arbitrary child variant because the chevron is drawn by
    // the component, not by this config: there is no node here to put a class
    // on. The full-width sidebar keeps it.
    className:
      'border-border text-foreground-subtle hover:text-foreground mt-auto w-full border-t px-2 pt-3 text-left text-md md:max-xl:justify-center md:max-xl:px-0 md:max-xl:[&>svg]:hidden',
    'data-testid': 'operator-menu',
  },
  children: [
    {
      type: 'avatar',
      size: 'sm',
      src: '$session.image',
      label: '$session.name',
      props: { 'data-testid': 'operator-avatar' },
    },
    // The name and the address go under the rail; the avatar stays, and the
    // trigger keeps its own accessible name (`triggerLabel`), so the control
    // is still announced as what it does rather than as who is signed in.
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-col text-left md:max-xl:hidden' },
      children: [
        {
          type: 'text',
          element: 'span',
          session: 'name',
          props: {
            className: 'text-foreground truncate text-sm font-medium',
            'data-testid': 'operator-name',
          },
        },
        {
          type: 'text',
          element: 'span',
          session: 'email',
          props: {
            className: 'text-foreground-muted truncate text-[11px]',
            'data-testid': 'operator-email',
          },
        },
      ],
    },
  ],
  menuItems: [
    { label: '$t:admin.shell.myAccount', action: { type: 'navigate', path: '/profile' } },
    { separator: true },
    {
      label: '$t:admin.shell.giveFeedback',
      action: {
        type: 'navigate',
        path: 'https://github.com/sovrium/sovrium/issues/new?labels=feedback',
      },
    },
    {
      label: '$t:admin.shell.reportBug',
      action: {
        type: 'navigate',
        path: 'https://github.com/sovrium/sovrium/issues/new?labels=bug',
      },
    },
    { separator: true },
    {
      label: '$t:admin.shell.signOut',
      variant: 'destructive',
      action: { type: 'auth', method: 'logout', onSuccess: { navigate: '/login' } },
    },
  ],
} as PageComponent

/**
 * The console's persistent sidebar: the `aside` frame and everything in it.
 *
 * Both drawer markers ride on this one element. `data-dashboard-aside` is what
 * the renderer's inline burger script toggles; `data-dashboard-sidebar` is the
 * ancestor `[internal ref]` walks up from the focused element
 * to prove Tab reached the navigation. They sat on two nested nodes while the
 * island rendered the inner one, and collapse onto one now that nothing renders
 * between the frame and the nav.
 *
 * `overflow-hidden` on the frame, with the scroll on `consoleNav`: the aside is
 * a fixed-height column whose FOOT (the operator menu) must stay pinned while
 * the nav scrolls. Two nested scroll containers made the foot ride the outer
 * scroll instead.
 */
export const consoleSidebar: PageComponent = {
  type: 'container',
  element: 'aside',
  props: {
    className:
      'hidden md:flex w-64 md:max-xl:w-14 shrink-0 border-r border-border bg-background-raised p-4 md:max-xl:px-2.5 flex-col gap-4 overflow-hidden',
    'data-dashboard-aside': 'true',
    'data-dashboard-sidebar': 'true',
  },
  // No language control here. The setting lives on `/profile`, where it is a
  // per-ACCOUNT choice the server keeps (`POST /api/auth/update-user`) rather
  // than a per-BROWSER one, and where a label can say so. Founder decision of
  // 2026-09-19: no language button at the bottom of the sidebar. It also ends
  // the reachability defect the wrapper here papered over — the switcher was
  // `md:max-xl:hidden`, so between 768 and 1279 the setting existed nowhere.
  children: [brandHeader, searchTrigger, consoleNav, operatorMenu],
} as PageComponent
