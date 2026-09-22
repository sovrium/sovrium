/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's persistent shell, expressed as config.
//
// ─── WHY A TYPESCRIPT HELPER AND NOT A `$ref` COMPONENT ────────────────────
//
// A reusable `components[]` template substitutes `$vars` into LEAVES; it cannot
// take a subtree as a slot, and the shell's whole job is to wrap one. So the
// composition is a plain function over `Component` literals, which is legitimate
// here for a reason specific to this app: `build:admin-preset` EVALUATES this
// config at build time and emits fully-expanded page literals into the binary.
// Nothing about `withShell` survives into the preset — the emitted JSON is
// exactly what a hand-written page would have been, only without the twenty-one
// copies. The one constraint that does bind is the `sovrium` import being
// type-only; a plain TS function composing literals is not affected by it.
//
// ─── ONE ISLAND LEFT, AND IT RENDERS NOTHING ───────────────────────────────
//
// `admin-spa-nav` is still hosted through the sanctioned
// `props: { 'data-island': … }` marker, because it is an enhancement marker
// rather than UI: it wires document-level listeners and draws no markup, so
// there is no component for it to become.
//
// The sidebar no longer is. `config/components/sidebar.ts` drives the GENERIC
// `sidebar` component, and the 1,492-line `admin-sidebar` island family it
// replaced is deleted. That was staged apart from the shell move on purpose —
// folding the two together would have made one failure indistinguishable from
// the other — and this is the second half landing.
//
// ─── WHAT THE SIDEBAR MUST STILL AGREE WITH ────────────────────────────────
//
// `dashboard-shell-surface.ts` is gone (jalon 5), so no second shell is left to
// stay byte-identical with. The constraint that outlives it is narrower and
// still real: the SPA nav swaps only `#admin-surface-content`, so the sidebar is
// NOT re-rendered on an in-console navigation. Anything in it that answers
// "where am I" therefore has to be re-derived on the client — which is what
// `trackNavigation` on the sidebar component does.

import palette from './palette'
import { consoleSidebar } from './sidebar'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The chrome bar's height, and the offset everything pinned BESIDE it derives
 * from — declared once, here, because the bar is this file's.
 *
 * `chrome` below is `min-h-12`: 48px including the hairline. Anything sticky in
 * the same scrolling column has to clear it, and the clearance is one 16px step,
 * so the offset is `top-16` (64px) and a full-height sticky box is
 * `max-h-[calc(100vh-4rem)]`. The three numbers are one decision.
 *
 * ─── WHY IT IS EXPORTED RATHER THAN WRITTEN TWICE ──────────────────────────
 *
 * It was written twice. This file pins the nav column, and
 * `pages/design-system/sections.ts` pins the on-this-page rail against the same
 * edge; when the bar went 53px → 48px only one of them moved, leaving a 24px
 * misalignment and turning `[internal ref]` red. A second reader
 * of one number is a second thing to remember, and the bar will move again.
 *
 * So: import these rather than spelling the class. `build:admin-preset`
 * evaluates this config and emits literals, so the constant costs nothing at
 * runtime and the emitted class still reaches the Tailwind corpus.
 */
export const CHROME_BAR_OFFSET_CLASS = 'top-16'

/**
 * The max height of a sticky box pinned at {@link CHROME_BAR_OFFSET_CLASS}.
 *
 * The same 4rem, on the other axis: without it a sticky box taller than the
 * viewport pins its top and runs its foot off the screen, which looks pinned
 * until the list is long enough to matter.
 */
export const CHROME_BAR_STICKY_MAX_H_CLASS = 'max-h-[calc(100vh-4rem)]'

/** What a surface may vary about its own shell. */
export interface ShellOptions {
  /**
   * Per-segment labels for the DERIVED breadcrumb trail.
   *
   * The trail is derived from the request path rather than enumerated, so a
   * surface declares only the human noun for its own slug (`profile` → "My
   * profile"). The root crumb and every href are the shell's, because a mounted
   * console's root is its MOUNT and only the renderer knows which one.
   */
  readonly breadcrumb?: Readonly<Record<string, string>>
  /**
   * Section-level controls drawn at the far right of the chrome bar.
   *
   * The ONE slot a surface gets in the shell's own bar, and it is right-aligned
   * by `ml-auto` on its own wrapper rather than by the bar's justification — so
   * a surface that supplies nothing leaves the breadcrumb exactly where it
   * always was, and emits no wrapper at all.
   *
   * ─── THE ORDER INSIDE IT IS A CONVENTION, NOT A DEFAULT ────────────────
   *
   * The bar reads breadcrumb · count · facts · actions · scheme toggle, in that
   * order, and the last four are all this one array. The shell cannot enforce
   * it — they are opaque components to it — so a surface supplies them already
   * ordered, and the scheme toggle goes LAST because it is the only control
   * that belongs to the reader rather than to the page. Every surface that
   * carries one puts it in the same place, which is what makes it findable
   * across a section someone moves through.
   *
   * A count and a facts line need live figures the read endpoints do not all
   * carry yet, so today only the scheme toggle is supplied. The slot is the
   * same one either way.
   */
  readonly chromeEnd?: readonly PageComponent[]
  /**
   * A second navigation column, drawn between the console sidebar and the
   * content — the docs-shaped surfaces' own navigation.
   *
   * Supplying it RESTRUCTURES the body: the chrome bar spans the column and the
   * content together, and the two sit in a row beneath it. Omitting it leaves
   * the body as one padded block — which is what makes this safe to add to a
   * shell twenty-odd pages share.
   *
   * The column scrolls WITH the page rather than on its own: it is content, not
   * chrome, so the SPA swap re-renders it and its current mark is never stale.
   */
  readonly navColumn?: readonly PageComponent[]
  /**
   * Let the body block SHRINK below its content, so a `table` inside it that
   * declares `layout: 'fill'` can own the scroll instead of the column.
   *
   * ─── WHY A FLAG, AND NOT SIMPLY THE DEFAULT ────────────────────────────
   *
   * `layout: 'fill'` is a contract about how a table behaves inside a BOUNDED
   * parent, and it does not create the bound. The chain it needs runs from the
   * shell's scroll column down to the table, and EVERY link in it must be both
   * allowed to grow and allowed to shrink below its content. This body block is
   * one of those links, and it is shared by every console page — so the
   * permission is opt-in per surface rather than granted to all of them.
   *
   * Measured before it was written, on `/tables/:table` at 1440×900. Three
   * links stand between the column and the grid; dressing ZERO, ONE or TWO of
   * them changes nothing at all — the column still scrolls 439px and the grid
   * still ends 423px below the fold. Only all three together move it: the
   * column's scrollable height goes to 0, the grid's own scroller takes the
   * 439px, and the pager lands at 884 of a 900px viewport. So this flag is not
   * one contribution among several that each help a little; without it the
   * other two do nothing whatsoever.
   *
   * ─── WHAT IT COSTS A PAGE THAT SETS IT WITHOUT A FILLING CHILD ─────────
   *
   * Nothing, as long as the body's children take their natural height: a flex
   * item is floored at the leftover space by `flex-1` and only shrinks when
   * something inside it asks to. It is still declared per surface rather than
   * globally, because a page whose body genuinely overflows would have that
   * overflow escape the block instead of lengthening it, and no console page
   * needs to find that out by accident.
   */
  readonly fill?: boolean
}

/**
 * The SPA client-nav host: an invisible marker the nav island hydrates into.
 *
 * Kept OUTSIDE `#admin-surface-content` so the global click interceptor and the
 * popstate handler survive a content swap. The island renders nothing — it only
 * wires document-level listeners — so this is an enhancement marker, not UI.
 */
const spaNavHost = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'hidden',
      'data-island': 'admin-spa-nav',
      'data-island-props': '{}',
    },
    children: [{ type: 'text', element: 'span', props: { className: 'sr-only' }, content: '' }],
  }) as PageComponent

/**
 * The mobile burger, shown only below `md`.
 *
 * The inline drawer-toggle script the renderer emits keys on
 * `data-dashboard-burger` and on the aside's `data-dashboard-aside`; both
 * markers must survive together or the drawer opens onto nothing.
 */
const burgerToggle = (): PageComponent =>
  ({
    type: 'button',
    // Chrome, not a call to action. A button that names no variant gets the
    // PRIMARY tone — a near-black fill — and the className here supplies a
    // border and a text colour but no ground, so the fill came through
    // underneath and the burger rendered as a black square.
    variant: 'ghost',
    props: {
      type: 'button',
      'aria-label': '$t:admin.shell.openMenu',
      'data-dashboard-burger': 'true',
      // 32px, not 36. It is the TALLEST thing in the chrome bar below `md`, and
      // the bar's height is a floor rather than a fixed value (see `chrome`), so
      // a 36px burger inside 12px of padding made the bar 49px on a phone and
      // 48px everywhere else — one console with two bar heights, and the taller
      // one recording the burger rather than the chrome. 32 + 12 + the hairline
      // is 45, so the floor binds and the bar is 48px at every width.
      className:
        'md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-border p-2 text-foreground-subtle hover:text-foreground',
    },
    content: '☰',
  }) as PageComponent

/**
 * The top chrome bar: burger, derived breadcrumb, and the optional `chromeEnd`.
 *
 * The trail is a landmark AND a hook, so it carries `data-testid`: a spec
 * asserting which crumbs link and which do not has to address the trail itself,
 * and resolving it by role would put every future `nav` on the shell in
 * competition for the same query.
 *
 * ─── IT FOLLOWS THE READER, AND THAT IS A SHELL PROPERTY ───────────────────
 *
 * `sticky top-0` inside `#admin-surface-content`, which is the one scrolling
 * region (the shell is `h-screen overflow-hidden`, so the document itself never
 * scrolls). A reader six thousand pixels down a Foundations page keeps the trail
 * that says where they are and the scheme toggle that repaints what they are
 * reading — both of which were unreachable without scrolling back up.
 *
 * ─── 48px, AND THE BAR IS THE ROW ─────────────────────────────────────────
 *
 * `min-h-12` with `border-box` is 48px INCLUDING the hairline — the console's
 * one bar height, and the only vertical chrome a surface pays before its own
 * content. It was 53px (an `h-9` row inside `pt-2 pb-2`, plus the border) and
 * 84px before that. The row and the bar are now the same element: the flex
 * column that wrapped the row existed only to give that row a parent.
 *
 * `min-h`, not `h`. A hard height was tried and reverted: on a phone the
 * derived trail wraps to a second line (`Sovrium Website / Records /` then
 * `journey_subscribers`), and a fixed box does not grow to hold it — the
 * second line spilled straight through the hairline and landed on the content
 * beneath. The old bar grew because its height sat on an INNER row; the floor
 * keeps that behaviour without the extra element. The nav column next door is
 * `lg:` and up, where the trail has never wrapped, so its DECLARED offset
 * still has a height it can trust. The two numbers move together —
 * `top-[4.5rem]` became `top-16` when the bar lost 5px, keeping the rail clear
 * of it by a full step.
 *
 * ─── IT SPANS THE WHOLE COLUMN, INCLUDING THE GUTTERS ──────────────────────
 *
 * The bar carries its OWN `px-4` and the scrolling column carries none, so the
 * hairline runs edge to edge instead of stopping 40px short on each side — a
 * rule that stops short reads as an underline belonging to the breadcrumb
 * rather than as the lid of the chrome. It is why `inset` is gone: both shapes
 * pad the bar the same way now, and the body does its own padding below.
 *
 * ─── THE PAGE TITLE IS HERE, AND IT IS NOT DRAWN ───────────────────────────
 *
 * Nothing in the bar is an `h1`. The visible page title is the LAST crumb of
 * the trail, which is the only place it appears — the console draws one header
 * row, not a bar and a title block under it. Each surface still needs exactly
 * one `h1` for the heading hierarchy to mean anything, and supplies it through
 * `pageHeading` (`config/components/dataPage.ts`), which emits it to assistive
 * technology only. See that file for why it sits there rather than here.
 */
/**
 * The scheme toggle every console page carries, at the far right of the bar.
 *
 * ─── WHY IT IS THE SHELL'S AND NOT EACH SURFACE'S ──────────────────────────
 *
 * Founder ruling, 2026-09-16: the reference boards draw a moon on EVERY board,
 * and the canvas wins. It is supplied here rather than through each page's
 * `chromeEnd` because a control a surface has to remember to pass is a control
 * some surface forgets — and a reader who found it on one page and not the
 * next would read its absence as "this page cannot be repainted" rather than as
 * an oversight.
 *
 * It goes LAST, after whatever the surface supplied, because it is the only
 * control in the bar that belongs to the READER rather than to the page. The
 * order the `chromeEnd` contract states — count, facts, actions, then the
 * scheme toggle — therefore holds by construction rather than by care.
 *
 * ─── ITS OWN TESTID, AND THAT IS A CONTRACT ────────────────────────────────
 *
 * `admin-scheme-toggle`, and it is now the only scheme toggle the console
 * declares. The design-system section supplied a second one under the name
 * `design-system-scheme-toggle` until 2026-09-16; the founder ruling of that
 * date — one toggle, in this bar, everywhere — removed it
 * (`config/pages/design-system/chrome.ts`), so this control is what every
 * console page repaints from, the section included.
 *
 * Keep the name anyway. `design-system-scheme-toggle` is what the section's
 * specs count, and they now count ZERO of it on every route; renaming this
 * control onto that testid would put the count back above zero everywhere and
 * report the removal as never having happened.
 *
 * ─── IT NEEDS THE APP TO DECLARE A SCHEME, AND THAT IS ALREADY DONE ────────
 *
 * A stored preference only survives a full load because `config/design.ts`
 * declares `colorScheme`, which is what emits the no-FOUC head script. Without
 * it the toggle would repaint the current document and every navigation would
 * come back light — the defect [internal ref]a measured and closed.
 */
const schemeToggle = (): PageComponent =>
  ({
    type: 'theme-toggle',
    variant: 'icon',
    props: { 'data-testid': 'admin-scheme-toggle' },
  }) as PageComponent

const chrome = (options: ShellOptions): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'bg-background border-border sticky top-0 z-20 flex min-h-12 flex-none items-center gap-3 border-b px-4 py-1.5',
      'data-testid': 'design-system-topbar',
    },
    children: [
      burgerToggle(),
      {
        type: 'breadcrumb',
        derive: 'path',
        home: { label: '$app.label' },
        ...(options.breadcrumb !== undefined ? { labels: options.breadcrumb } : {}),
        // ─── THE TRAIL IS ONE ROW, AND THE APP NAME IS WHAT GIVES WAY ───────
        //
        // The bar declares `min-h-12`, and a `min-h` floor is pushed past by
        // the tallest CHILD. The breadcrumb's own `<ol>` ships `flex-wrap:
        // wrap` from the platform recipe, so a three-segment trail at phone
        // width wraps to two lines and the bar becomes 65px — measured on
        // `/forms/journey` and `/tables/:table` at 320/360/375. That is two
        // header designs sharing one selector, and `[internal ref]` asserts the single constant for exactly that reason.
        //
        // So the row is forced to `nowrap` and ONE item is allowed to shrink:
        // the first, which is the app name. The tail — the separators and the
        // page the operator is actually on — keeps its full width, because
        // clipping the end would truncate the one segment that says where you
        // are. `min-w-0` is required on the flex items as well as the nav: a
        // flex item's default `min-width: auto` refuses to shrink below its
        // content, which is what makes an un-prefixed `truncate` inert here.
        props: {
          'data-testid': 'breadcrumb',
          className:
            'min-w-0 flex-1 overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate',
        },
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'ml-auto flex items-center gap-2',
          'data-testid': 'chrome-end',
        },
        children: [...(options.chromeEnd ?? []), schemeToggle()],
      },
    ],
  }) as PageComponent

/**
 * Wrap a page's own components in the persistent console shell.
 *
 * `h-screen overflow-hidden`, not `min-h-screen`: the shell is a fixed-viewport
 * app frame whose two columns scroll independently. Under `min-h-screen` the row
 * grew to the tallest column, so NEITHER child's `overflow-y-auto` ever engaged
 * — the whole document scrolled and the sidebar foot dropped below the fold.
 *
 * `data-admin-base-path` is written MOUNT-RELATIVE (`/`) and moved onto the real
 * base by the same walk that moves every other console link, which is how the
 * client islands learn which mount is serving them without `basePath` being
 * threaded through every page.
 *
 * @param page - the surface, whose `components` are its BODY (not yet framed).
 * @param options - what this surface varies about the shell.
 */
export function withShell(page: PageConfig, options: ShellOptions = {}): PageConfig {
  const body = page.components ?? []
  const navColumn = options.navColumn
  return {
    ...page,
    components: [
      {
        type: 'container',
        element: 'div',
        props: {
          'data-admin-base-path': '/',
          className: 'flex h-screen overflow-hidden bg-background text-foreground',
        },
        children: [
          consoleSidebar,
          // Content column. The page renderer already wraps every page in a
          // single `<main id="main-content">`, so this is a plain `div` — a
          // second `element: 'main'` would duplicate the `main` landmark.
          //
          // `id="admin-surface-content"` is the stable swap target for SPA
          // content-only navigation: the client nav module replaces ONLY this
          // column's contents, leaving the sidebar and the palette — which live
          // outside it — mounted. The breadcrumb lives INSIDE, so it repaints
          // with the surface.
          //
          // ─── THE SCROLLER PADS NOTHING; THE BAR AND THE BODY PAD THEMSELVES
          //
          // 16px gutters, down from 40px. A console is read at the density of
          // its data, and 40px of air on each side of a grid is 80px the grid
          // does not get — measured against the reference, the widest surfaces
          // lost a column to it. The bar takes its own 16px so its hairline
          // runs the full width (see `chrome`), and the body takes the same
          // 16px plus 12px of clearance under that hairline.
          //
          // ─── TWO SHAPES, AND THE SECOND IS THE ONE WITH A NAV COLUMN ────
          //
          // Without one the bar and a single padded body block stack inside the
          // scroller. With one the body splits in two — the nav column and the
          // content sit in a row beneath the same bar — and the column is flush
          // against the sidebar because it IS the next column of the same
          // navigation. Both shapes keep the bar as a DIRECT child of the
          // scroller, which is what makes `sticky top-0` pin to the viewport
          // rather than to a wrapper.
          navColumn === undefined
            ? {
                type: 'container',
                element: 'div',
                props: {
                  id: 'admin-surface-content',
                  'data-admin-content': 'true',
                  className: 'flex flex-1 flex-col overflow-y-auto',
                },
                children: [
                  chrome(options),
                  {
                    type: 'container',
                    element: 'div',
                    props: {
                      className: options.fill
                        ? 'flex min-w-0 min-h-0 flex-1 flex-col gap-6 px-4 pt-3 pb-4'
                        : 'flex min-w-0 flex-1 flex-col gap-6 px-4 pt-3 pb-4',
                    },
                    children: [...body],
                  },
                ],
              }
            : {
                type: 'container',
                element: 'div',
                props: {
                  id: 'admin-surface-content',
                  'data-admin-content': 'true',
                  className: 'flex flex-1 flex-col overflow-y-auto',
                },
                children: [
                  chrome(options),
                  {
                    type: 'container',
                    element: 'div',
                    props: { className: 'flex flex-1 items-start' },
                    children: [
                      {
                        // A plain `div`, not an `aside`: the column's only job
                        // is to hold a navigation, and the `sidebar` inside it
                        // already publishes that landmark under its own name.
                        // An `aside` would add a second, complementary one
                        // wrapping it — a landmark whose whole content is
                        // another landmark.
                        //
                        // ─── TWO BOXES, AND THE OUTER ONE IS NOT PINNED ─────
                        //
                        // The frame stays `self-stretch` so its rule runs the
                        // whole page. Pinning the frame itself would end the
                        // rule at the window line and leave the page unlined
                        // below it — the same reasoning the console sidebar's
                        // fixed frame follows one level out. What pins is the
                        // box INSIDE it, which is viewport-height and scrolls
                        // its own overflow.
                        type: 'container',
                        element: 'div',
                        props: {
                          className:
                            'border-border hidden w-52 flex-none flex-col self-stretch border-r px-3 pt-2 lg:flex',
                          'data-testid': 'design-system-nav-column',
                        },
                        children: [
                          {
                            // The offset is the rail's offset next door, not a
                            // second number: the two columns beside the bar pin
                            // to the SAME edge, and a column that cleared the
                            // bar by a different margin would read as a
                            // misalignment rather than as a decision. Both now
                            // read it from `CHROME_BAR_OFFSET_CLASS` above,
                            // which is where the bar's own height is decided —
                            // see that constant for what writing it twice cost.
                            //
                            // The bottom padding is HERE and not on the frame.
                            // A sticky box is bounded by its container, so a
                            // frame that stops 32px early hands those 32px back
                            // at the foot of the page: measured, the column
                            // drifted from 104 to 72 on the last screen of a
                            // moderately long type page. Padding the pinned box
                            // instead lets the frame run to the true bottom and
                            // the column holds its offset the whole way.
                            type: 'container',
                            element: 'div',
                            props: {
                              className: `sticky ${CHROME_BAR_OFFSET_CLASS} flex ${CHROME_BAR_STICKY_MAX_H_CLASS} flex-col gap-4 overflow-y-auto pb-8 [scrollbar-width:thin]`,
                              'data-testid': 'design-system-nav-column-scroller',
                            },
                            children: [...navColumn],
                          },
                        ],
                      },
                      {
                        type: 'container',
                        element: 'div',
                        props: {
                          className: 'flex min-w-0 flex-1 flex-col gap-6 px-4 pt-3 pb-4',
                        },
                        children: [...body],
                      },
                    ],
                  },
                ],
              },
          palette,
          spaNavHost(),
        ],
      },
    ],
  } as PageConfig
}
