/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's persistent shell: the library's `console-shell` block,
// INSTALLED as a literal copy in `./console-shell.ts`, with its two open
// bindings filled here — the sidebar's `groups` and the body slot after the
// header.
//
// ─── WHY A TYPESCRIPT HELPER AND NOT A `$ref` COMPONENT ────────────────────
//
// A reusable `components[]` template substitutes `$vars` into LEAVES; it cannot
// take a subtree as a slot, and the shell's whole job is to wrap one. So the
// composition is a plain function over `Component` literals. `build:admin-preset`
// EVALUATES this config at build time and emits fully-expanded page literals into
// the binary, so nothing about `withShell` survives into the preset.
//
// ─── ONE ISLAND LEFT, AND IT RENDERS NOTHING ───────────────────────────────
//
// `admin-spa-nav` is hosted through the sanctioned `data-island` marker because
// it is an enhancement marker rather than UI: it wires document-level listeners
// and draws no markup. It and the command palette sit OUTSIDE the frame, so an
// SPA swap of `#admin-surface-content` never unmounts them.
//
// ─── WHAT THE SIDEBAR MUST STILL AGREE WITH ────────────────────────────────
//
// The SPA nav swaps only `#admin-surface-content` (the content column, header
// included), so the sidebar is NOT re-rendered on an in-console navigation.
// Anything in it that answers "where am I" is re-derived on the client — which
// is what the copy's `trackNavigation` binding does.

import { consoleShellCopy } from './console-shell'
import palette from './palette'
import { consoleNavGroups } from './sidebar-nav'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The offset anything pinned BESIDE the site header derives from — declared
 * once, here, because the header is this file's.
 *
 * The block's header is `h-12`: 48px including the hairline. Anything sticky in
 * the same scrolling column clears it by one 16px step, so the offset is
 * `top-16` (64px) and a full-height sticky box is `max-h-[calc(100vh-4rem)]`.
 * The three numbers are one decision; import these rather than spelling the
 * class (`pages/design-system/sections.ts` pins its rail against the same edge).
 */
export const CHROME_BAR_OFFSET_CLASS = 'top-16'

/** The max height of a sticky box pinned at {@link CHROME_BAR_OFFSET_CLASS}. */
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
   * Path segments of that trail to keep as TEXT — a prefix that answers no
   * page (`/automations/runs` under a run's own page), which would otherwise
   * be a crumb linking to a 404. Named by the URL segment, not its label.
   */
  readonly breadcrumbUnlinked?: readonly string[]
  /**
   * The label of the trail's LAST crumb, in place of its URL segment — the
   * noun for the object a page shows (`Run`), where the segment is its id.
   */
  readonly breadcrumbCurrent?: string
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
   * The nav column folds into a phone DRAWER below `lg` instead of vanishing.
   *
   * Set it only when the column's navigation is a `sidebar` carrying its own
   * `drawer`: the frame then dissolves (`contents`) below `lg`, so the sidebar's
   * menu button and sheet stand in for the column, and returns as the column at
   * `lg` and above. A column with no drawer-capable `sidebar` keeps the default,
   * hidden below `lg`, rather than spilling its rows into the page.
   */
  readonly navColumnDrawer?: boolean
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
  /**
   * The body is the page's own content column: a page built on dashboard-01's
   * content column (`dashboardContent`) pads its sections itself, so the slot
   * adds no padding of its own.
   */
  readonly flush?: boolean
  /**
   * The page reads top to bottom — a reference, a setting, one record's own
   * page — so its body stops at one reading width (`max-w-5xl`, 1024 px)
   * instead of running to the edge.
   *
   * ─── ONE WIDTH RULE, DECIDED HERE AND NOWHERE ELSE ─────────────────────
   *
   * A page whose body is a data table, a grid of specimens or a dashboard runs
   * the full width: columns are what the width is for. Every other console page
   * sets this flag, and its blocks carry no cap of their own — a card capped at
   * `max-w-3xl` inside a page capped at `max-w-4xl` beside a third page capped
   * at neither is how the console came to have five content widths. A sentence
   * may still keep its reading measure; a layout block may not keep a width.
   */
  readonly document?: boolean
  /**
   * One short fact about the page, in the top bar beside the trail — a count
   * the reader should see whichever view of the page is open below.
   */
  readonly topbarFact?: PageComponent
}

/**
 * The SPA client-nav host: an invisible marker the nav island hydrates into.
 *
 * Kept OUTSIDE `#admin-surface-content` so the global click interceptor and the
 * popstate handler survive a content swap.
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
 * The offline notice the SPA nav places in the content region when a
 * navigation cannot reach the server, kept hidden OUTSIDE the region so it is
 * served once, in the page's language, and survives every swap. The nav clones
 * its child under the top bar and wires `data-spa-retry`; back online, it
 * retries the navigation by itself.
 */
const offlineNotice = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'hidden', 'data-spa-offline-template': 'true' },
    children: [
      {
        type: 'container',
        element: 'div',
        props: {
          role: 'status',
          className:
            'border-border bg-muted text-foreground m-4 flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm',
        },
        children: [
          { type: 'text', element: 'p', content: '$t:admin.offline.message' },
          {
            type: 'button',
            variant: 'outline',
            content: '$t:admin.offline.retry',
            props: { type: 'button', 'data-spa-retry': 'true' },
          },
        ],
      },
    ],
  }) as PageComponent

/** The body's own block: 16px all round, a 24px rhythm between sections. */
const BODY_CLASS = 'flex min-w-0 flex-1 flex-col gap-6 p-4'

/** A document page's body: the same block, stopped at one reading width. */
const DOCUMENT_BODY_CLASS = `${BODY_CLASS} w-full max-w-5xl`

/** The body block a page gets, by {@link ShellOptions.document}. */
const bodyClassOf = (options: ShellOptions): string =>
  options.document === true ? DOCUMENT_BODY_CLASS : BODY_CLASS

/**
 * The body slot: the page's components, or — with a nav column — the column and
 * the content side by side.
 *
 * `fill` lets the body SHRINK below its content, so a `table` inside it that
 * declares `layout: 'fill'` can own the scroll instead of the column. It is
 * opt-in per surface: a page whose body genuinely overflows would otherwise have
 * that overflow escape the block instead of lengthening it.
 */
const bodySlot = (body: readonly PageComponent[], options: ShellOptions): PageComponent => {
  const { navColumn } = options
  if (options.flush === true) {
    return {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-1 flex-col' },
      children: [...body],
    } as PageComponent
  }
  if (navColumn === undefined) {
    return {
      type: 'container',
      element: 'div',
      props: { className: options.fill ? `${bodyClassOf(options)} min-h-0` : bodyClassOf(options) },
      children: [...body],
    } as PageComponent
  }
  return {
    type: 'container',
    element: 'div',
    // With a drawer the row STACKS below `lg`: the column has dissolved into
    // its sidebar's menu button, which then sits above the content rather
    // than beside it, eating the width a phone does not have.
    props: {
      className:
        options.navColumnDrawer === true
          ? 'flex flex-1 flex-col lg:flex-row lg:items-start'
          : 'flex flex-1 items-start',
    },
    children: [
      {
        // A plain `div`: the `sidebar` inside already publishes the landmark.
        // Drawn from `xl` only: at 1024 px a second 208 px column beside the
        // console sidebar left the content about 560 px.
        // The frame stays `self-stretch` so its rule runs the whole page; the
        // box INSIDE it pins at the header's edge and scrolls its own overflow.
        type: 'container',
        element: 'div',
        props: {
          className: `border-border ${options.navColumnDrawer === true ? 'contents' : 'hidden'} w-52 flex-none flex-col self-stretch border-r px-3 pt-2 xl:flex`,
          'data-testid': 'design-system-nav-column',
        },
        children: [
          {
            type: 'container',
            element: 'div',
            props: {
              className: `sticky ${CHROME_BAR_OFFSET_CLASS} ${options.navColumnDrawer === true ? 'contents lg:flex' : 'flex'} ${CHROME_BAR_STICKY_MAX_H_CLASS} flex-col gap-4 overflow-y-auto pb-8 [scrollbar-width:thin]`,
              'data-testid': 'design-system-nav-column-scroller',
            },
            children: [...navColumn],
          },
        ],
      },
      {
        type: 'container',
        element: 'div',
        props: { className: bodyClassOf(options) },
        children: [...body],
      },
    ],
  } as PageComponent
}

/** The site header of the copy, with this surface's breadcrumb labels. */
const siteHeader = (options: ShellOptions): PageComponent => {
  const [header] = consoleShellCopy.children[1].children
  const [trail, end] = header.children
  return {
    ...header,
    children: [
      {
        ...trail,
        ...(options.breadcrumb !== undefined ? { labels: options.breadcrumb } : {}),
        ...(options.breadcrumbUnlinked !== undefined
          ? { unlinked: options.breadcrumbUnlinked }
          : {}),
        ...(options.breadcrumbCurrent !== undefined
          ? { currentLabel: options.breadcrumbCurrent }
          : {}),
      },
      ...(options.topbarFact === undefined ? [] : [options.topbarFact]),
      end,
    ],
  } as PageComponent
}

/**
 * Wrap a page's own components in the persistent console shell.
 *
 * The frame is the installed `console-shell` copy: a fixed-viewport app frame
 * (`h-svh overflow-hidden`) whose sidebar and content column scroll on their own.
 * Its content column carries `id="admin-surface-content"`, the stable swap target
 * of the SPA nav. The page renderer already wraps every page in one
 * `<main id="main-content">`, so the column is a plain `div`.
 *
 * `data-admin-base-path` is written MOUNT-RELATIVE (`/`) and moved onto the real
 * base by the same walk that moves every console link, which is how the client
 * islands learn which mount is serving them.
 *
 * @param page - the surface, whose `components` are its BODY (not yet framed).
 * @param options - what this surface varies about the shell.
 */
export function withShell(page: PageConfig, options: ShellOptions = {}): PageConfig {
  const [sidebar, inset] = consoleShellCopy.children
  return {
    ...page,
    components: [
      {
        type: 'container',
        element: 'div',
        props: { 'data-admin-base-path': '/', className: 'contents' },
        children: [
          {
            ...consoleShellCopy,
            children: [
              { ...sidebar, groups: consoleNavGroups },
              {
                ...inset,
                children: [siteHeader(options), bodySlot(page.components ?? [], options)],
              },
            ],
          },
          palette,
          spaNavHost(),
          offlineNotice(),
        ],
      },
    ],
  } as PageConfig
}
