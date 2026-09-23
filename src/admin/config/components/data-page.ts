/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Chrome shared by the operator-DATA surfaces — the pages about the app's own
// contents rather than about the operator's account.
//
// ─── WHY THIS EXISTS SEPARATELY FROM `card.ts` ─────────────────────────────
//
// `card.ts` names the frame of the three ACCOUNT pages, which are narrow
// single-column forms. The data surfaces are wide, and what they share is not a
// card but a HEADING: every one of them names itself once, the same way, and
// they read as one console only while that is identical across all of them. It
// was `dataPageIntro` in the TypeScript builders for exactly that reason; this
// is the same guarantee with the same single copy.
//
// ─── THE TITLE BLOCK IS GONE; THE HEADING IS NOT ───────────────────────────
//
// Until this wave every data surface opened with a 30px title and a two-line
// paragraph under the chrome bar, and the bar's last crumb said the same word
// directly above it. The console draws ONE header row now — the 48px bar,
// whose trail ends in the page's own name — and the title block is retired.
// That returns ~90px above the fold on a dozen surfaces, which on a grid page
// is three more rows of data before anyone scrolls.
//
// What could not go with it is the `h1`. A document with no first-level heading
// leaves a screen-reader user no way to answer "what page is this?" except by
// reading the navigation, and `getByRole('heading')` is how the specs address a
// surface at all. So the heading and its orienting sentence stay, addressed to
// assistive technology only: `sr-only` is a 1px clip rather than
// `display: none`, so both are in the accessibility tree and neither is drawn.
//
// On a FLAT data surface the heading and the trail's last crumb are the same
// page saying its own name twice — once to a reader, once to a screen reader —
// so they must not drift apart. `/links` is "Links" in both.
//
// On an OBJECT sub-page they deliberately differ, and that is not drift: the
// heading names the SURFACE and the crumb names the object inside it.
// `/tables/contacts` is `h1` "Records" under a trail ending "contacts", and the
// same holds for `forms/:form`, `buckets/:bucket` and `agents/:agent`. A
// screen-reader user gets "what kind of page is this" from the heading and
// "which one" from the trail; collapsing them would lose one or the other.
//
// ─── `h1`, NOT `h2` ────────────────────────────────────────────────────────
//
// Every data page routes its title through here, so this one element decides
// the heading hierarchy of a dozen pages. They all shipped with no `h1` at all
// once, while the Developer pages used one: a page whose title is an `h2` reads
// to a screen reader as a section of some absent parent.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The heading every data surface names itself by: `h1` + orienting sentence,
 * both `sr-only`.
 *
 * Both arguments are `content`-bound, so both may be `$t:` tokens — that is the
 * one place on the dynamic render path where a token actually resolves. Props,
 * and any field an island hosts, must stay literal.
 *
 * It stays a PAGE component rather than a shell option because two surfaces
 * gate it: `/pages` declares two of these under opposite `visibility` records
 * so exactly one reaches the document, which is what keeps the `h1` count at
 * one on an app with analytics off. A shell option is one value per page and
 * could not express that.
 */
export function pageHeading(heading: string, blurb: string): PageComponent {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'sr-only' },
    children: [
      { type: 'text', element: 'h1', content: heading },
      { type: 'text', element: 'p', content: blurb },
    ],
  } as PageComponent
}

/**
 * Mount an object-scoped body FULL-WIDTH in the content column.
 *
 * No left rail, no two-pane split, no "pick an object" prompt: the authoritative
 * object picker is the sidebar's auto-expanded disclosure. `min-w-0` is what
 * lets a wide grid actually fill the column instead of overflowing it.
 */
export function fullWidth(body: PageComponent): PageComponent {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex min-w-0 flex-1 flex-col pt-2' },
    children: [body],
  } as PageComponent
}

/**
 * Mount a body that IS a filling grid: full-width, and allowed to shrink below
 * its content so the table inside can take the leftover height.
 *
 * The bounded-parent half of `table`'s `layout: 'fill'`. That schema is
 * explicit that `fill` describes how a table behaves inside a bounded parent
 * and does NOT create the bound — so a page that wants a filling grid supplies
 * the chain itself, in three parts: `withShell(page, { fill: true })` for the
 * block above, this for the link below it, and `layout: 'fill'` on the table.
 *
 * All three or none. Measured on `/tables/:table` at 1440×900: with two of the
 * three the column still scrolls its full 439px and the grid still ends 423px
 * below the fold — byte-identical to shipping none of them. There is no partial
 * credit in a flex chain, which is why these are not three independent polish
 * decisions but one.
 *
 * The difference from {@link fullWidth} is `min-h-0` and nothing else. They stay
 * two functions rather than one with a flag because they say different things
 * about a surface: `fullWidth` is "this body is one wide column", and this is
 * "this body IS the grid, and the grid owns the page's scroll". A surface with
 * sections stacked above its grid wants the first even though it has a table in
 * it — which is why six of the console's seven grid pages still call it.
 *
 * `pt-2` is `fullWidth`'s, kept identical so a page moving between the two does
 * not shift by 8px.
 *
 * Takes the children directly rather than a single body — unlike `fullWidth` —
 * because a grid page's other component is a `drawer`, which renders its body
 * in a PORTAL and so contributes no height here. Wrapping the pair in a second
 * box just to hand this one a single child would put two identically-dressed
 * divs in the chain, and every extra link is another place the chain can be
 * broken by an edit that looks harmless. There is `gap` for the same reason:
 * the drawer's host is empty, and a gap before an empty box is 24px of the
 * grid's height spent on nothing.
 */
export function fillHost(children: readonly PageComponent[]): PageComponent {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex min-h-0 min-w-0 flex-1 flex-col pt-2' },
    children: [...children],
  } as PageComponent
}

/**
 * The whole-page empty state for a surface whose object list is empty.
 *
 * An honest "nothing to show" plus what to do next, rather than a grid with no
 * columns — which is what an object-scoped page renders when the operator has
 * declared none of the objects it administers.
 */
export function emptyState(title: string, body: string, hint: string): PageComponent {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': title,
      className:
        'border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: title,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-md leading-relaxed' },
        content: body,
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-md italic' },
        content: hint,
      },
    ],
  } as PageComponent
}

// ─── SUB-VIEWS: ONE ROUTE, ONE TAB STRIP ───────────────────────────────────
//
// Six console surfaces answer two questions each — the audience of the pages
// and the footprint of the instance, the run history and the catalogue that
// produced it, the submissions and their drop-off, the members and the people
// invited to become one. They shipped as six pairs of sibling routes, so an
// operator comparing the two halves of one subject navigated between two
// documents and lost their place in both.
//
// A tab strip is the answer the canvas draws, and it is what these helpers
// build: ONE route, one heading, one breadcrumb, and a strip that names the
// question the other half answers. `?tab=` is what makes each half still have
// an address — a link to "the invitations" survives, which is the whole reason
// the sibling routes existed.
//
// ─── THE TWO RULES THE `tabs` COMPONENT ENFORCES ───────────────────────────
//
// 1. `panels[i]` names the tab that shows `children[i]`, and declaring a
//    different number of each is REFUSED BY NAME at decode. So a panel whose
//    body is conditional must keep a stable child in that slot and alternate
//    INSIDE it — never gate the child itself, which would shift every index
//    after it and silently file each body under the wrong tab.
// 2. A panel id is slugified from the authored label when omitted, and for a
//    `$t:` label that slug is the TRANSLATION KEY. Every panel here declares
//    its `id` explicitly, because the id is the `?tab=` value an operator
//    types and a spec asserts, and it must not move with the locale.
//
// ─── A TAB LABEL IS A LITERAL, AND THAT IS WHY THERE ARE NO COUNT BADGES ───
//
// The canvas draws a live count beside several captions — `Automations 3`,
// `Invitations 2`, `Keys 4`. None ship, and it is not an omission: a `panels[]`
// entry is a STRUCT of plain strings with no `dataSource`, and its fields are
// serialized into the island's `data-island-props` verbatim. Measured on `/mcp`,
// whose page already binds `/api/admin/instance` as its record: a
// `description: '$record.mcpToolCount tools'` reaches the DOM as the literal
// text `$record.mcpToolCount tools`. Same trap as `kpi.label`, one component
// over — an island-hosted field is not on the substitution path.
//
// So a counted trigger needs a platform change, not a config one. Until then a
// caption names its half and the panel states its own figures.

/** The stable id of one sub-view, and the caption on its trigger. */
export interface TabSpec {
  readonly id: string
  readonly label: string
}

/**
 * The `page.query` block a tabbed surface must declare for `?tab=` to resolve.
 *
 * `$query.tab` is substituted into every string of the page's component tree,
 * but ONLY for a property the page declared: an undeclared name is left
 * verbatim on purpose, so a `defaultTab: '$query.tab'` without this block
 * selects a tab literally called `$query.tab` and the strip opens on its first
 * panel with no error anywhere. The `enum` is the allow-list — a URL value
 * outside it CLAMPS to the default, which is what makes `?tab=<anything>`
 * answer 200 rather than 404.
 */
export function tabQuery(
  specs: readonly TabSpec[],
  /**
   * Which tab a bare URL opens on. Defaults to the first.
   *
   * Supplied by the RETAINED sibling routes — `/footprint`, `/users/invitations`
   * — which render the same strip as their parent and differ from it in exactly
   * this: the half the address named is the half that opens. That is what keeps
   * a bookmark to one of them meaning what it meant, on a console mount where
   * `redirects[]` decodes, ships, and then does nothing at all.
   */
  defaultId?: string
): { readonly tab: { readonly default: string; readonly enum: readonly string[] } } {
  const ids = specs.map((spec) => spec.id)
  const fallback = ids[0]
  // Both throws are AUTHORING-TIME assertions, not runtime error handling, and
  // that is why they are throws rather than a typed failure. This helper runs
  // while the console config is being built — before a server exists, inside an
  // object literal whose value is a `PageConfig` — so there is nowhere for an
  // `Effect` or a `Result` to go. The alternative is returning a sentinel tab
  // strip, which would ship a console whose deep links silently do nothing.
  // Failing the boot is the correct outcome and the author is the only reader.
  // eslint-disable-next-line functional/no-throw-statements -- authoring-time assertion; see above
  if (fallback === undefined) throw new Error('tabQuery: at least one tab is required')
  const chosen = defaultId ?? fallback
  if (!ids.includes(chosen)) {
    // eslint-disable-next-line functional/no-throw-statements -- authoring-time assertion; see above
    throw new Error(`tabQuery: “${chosen}” is not one of ${ids.join(', ')}`)
  }
  return { tab: { default: chosen, enum: ids } }
}

/**
 * The tab strip and its panels, deep-linked to `?tab=`.
 *
 * `defaultTab` is `$query.tab` rather than a literal so the URL is what decides
 * which half opens. It resolves SERVER-side, so a deep link paints the right
 * panel in the first response rather than after hydration.
 *
 * `aria-label` names the `role="tablist"`. It is threaded to the island
 * explicitly by the renderer, so — unlike most island-hosted fields — it is one
 * of the few that a `$t:` token reaches.
 */
export function tabbedBody(
  ariaLabel: string,
  specs: readonly TabSpec[],
  bodies: readonly PageComponent[],
  /**
   * Make the tab set a LINK IN A FILL CHAIN rather than a flowing block.
   *
   * The tab set was the one link a page could not dress: the mount host the
   * tabs island renders is deliberately layout-neutral (the fix behind
   * `[internal ref]`/`-018`), so a page that dressed every OTHER reachable
   * link was measured to leave its grid at exactly the natural height it would
   * have had if it had dressed none. `layout: 'fill'` is how the author says
   * the set is part of the chain, and the platform passes the bound through the
   * host, the SSR wrapper, the root, the active panel and ONE wrapper inside
   * that panel.
   *
   * All of it or none, as ever: `withShell(page, { fill: true })` above,
   * `fillHost`/`fullWidth` between, this here, and `layout: 'fill'` on the
   * grid. Two of the four buy nothing at all.
   */
  options: { readonly fill?: boolean } = {}
): PageComponent {
  return {
    type: 'tabs',
    defaultTab: '$query.tab',
    ...(options.fill === true ? { layout: 'fill' as const } : {}),
    panels: specs.map((spec) => ({ id: spec.id, label: spec.label })),
    props: { 'aria-label': ariaLabel, 'data-testid': 'admin-subview-tabs' },
    children: bodies,
  } as PageComponent
}

/**
 * One panel body, as a stable container.
 *
 * Every panel goes through here rather than handing its own component straight
 * to {@link tabbedBody}, for the index rule above: a body that is a single
 * component today and an alternating pair tomorrow keeps the same slot, and
 * `gap-6` gives the sections inside it the same rhythm the ungated page had.
 */
export function tabPanel(
  children: readonly PageComponent[],
  /**
   * Give this panel its OWN scroll.
   *
   * Only meaningful inside a tab set declaring `layout: 'fill'`, and there it
   * is not optional polish. `fill` bounds the set, so EVERY panel of it becomes
   * a column that may shrink below its content — including the panels that are
   * not the filling grid. Without a scroller such a panel's overflow escapes
   * the block rather than lengthening it, and the page it was authored for
   * stops being reachable at the bottom.
   *
   * So a filling tab set reads: the grid panel takes the default (the grid owns
   * the scroll), and every SIBLING panel takes this.
   */
  options: { readonly scroll?: boolean } = {}
): PageComponent {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: options.scroll
        ? 'flex min-h-0 min-w-0 flex-col gap-6 overflow-y-auto'
        : 'flex min-w-0 flex-col gap-6',
    },
    children,
  } as PageComponent
}

/**
 * The 40 px control row that sits between the chrome bar and a surface's body.
 *
 * ONLY where a page has page-level controls. Every `toolbar:` in the console is
 * the table island's own and lives INSIDE the grid, so this row exists for the
 * affordances that belong to the PAGE rather than to one component — the invite
 * button, a period chip group, an outbound reference link.
 *
 * `min-h-10` rather than `h-10` for the reason the chrome bar carries a floor
 * too: a row of chips wraps on a phone, and a fixed height does not grow to
 * hold the second line — it spills it onto the content below.
 */
export function toolbarRow(children: readonly PageComponent[]): PageComponent {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'flex min-h-10 flex-wrap items-center gap-2',
      'data-testid': 'admin-toolbar-row',
    },
    children,
  } as PageComponent
}
