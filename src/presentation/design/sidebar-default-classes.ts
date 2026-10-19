/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Class computers for the `sidebar` component on shadcn/ui's anatomy — the
 * box, its navigation, groups, entries, badges and disclosures. The menu item and
 * badge, the rows and disclosures, and the drawer live in leaf modules
 * (`sidebar-{menu,entry,drawer}-default-classes.ts`), re-exported below.
 *
 * ## Anatomy
 * base-nova's `ui/sidebar.tsx` at Sovrium's defaults: a sidebar that does not
 * collapse (`collapsible: none`), `variant: sidebar`, on the left. Every part
 * carries shadcn's `data-slot` name beside the `data-sidebar-*` names it already
 * had; the renderers stamp them.
 *
 *   sidebar                 the box: the `--sidebar` ground and foreground
 *   sidebar-content         the navigation root (`data-sidebar-root`)
 *   sidebar-group           one labelled section
 *   sidebar-group-label     its heading
 *   sidebar-menu            the `<ul>` of rows
 *   sidebar-menu-item       one `<li>`
 *   sidebar-menu-button     a top-level row, or a whole-row toggle
 *   sidebar-menu-badge      the marker or count after a label
 *   sidebar-menu-action     the chevron button beside a row that has a page
 *   sidebar-menu-sub        the nested `<ul>` a disclosure reveals
 *   sidebar-menu-sub-item   one nested `<li>`
 *   sidebar-menu-sub-button a nested row
 *   sidebar-trigger         the menu button that opens the phone drawer
 *
 * ## Why it lives here
 * The sidebar is drawn TWICE: the server draws it in
 * `render/registry/sidebar-{groups,entry,entry-parts}.tsx`, and three islands
 * under `islands/navigation/` redraw parts of it. `presentation/design` is the
 * one tree both sides may import, so the class strings live here once.
 *
 * ## Departures from base-nova, each one written down in the fragment
 * - **The current row's fill is a class the renderer chooses**, not base-nova's
 *   `data-active:` variant. The row still states `data-active`; but an app's
 *   `design.components.sidebar.states.current` is written as an
 *   `aria-[current=page]:` variant and must beat the recipe, which a plain
 *   class does and a second attribute variant would not reliably do.
 * - **The badge flows after the label** instead of sitting absolutely at the
 *   row's end, because a rail unpaints the label and the badge together as the
 *   row's direct `span` children.
 * - **The chevron button sits in its own grid column** beside the row rather
 *   than absolutely over it, and keeps a 24 px target.
 * - **The rail** (`sidebar.rail`) and **the drawer** (`sidebar.drawer`) are
 *   Sovrium's: base-nova collapses to icons or slides off-canvas instead, which
 *   the schema adds later as `collapsible`.
 */

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR GROUPS — heading / list / entry
// ──────────────────────────────────────────────────────────────────────────────

/** The box: base-nova's non-collapsing sidebar ground and foreground. */
const SIDEBAR_BOX_CLASS = 'bg-sidebar text-sidebar-foreground'

/**
 * The navigation root (`sidebar-content`): a column of groups with no gap of
 * its own, because each group pads itself, and the part that scrolls when the
 * groups outgrow the panel.
 *
 * While more lies below, its last 3 rem fades out, so groups that run on
 * below the pinned footer read as continuing rather than as cut by it; the
 * matching bottom padding lets the last row scroll clear of the fade. 3 rem is
 * more than one row pitch (32–36 px): a shorter fade can land in the gap
 * between two rows, fade nothing, and read as a hard edge. The fade
 * is the `sv-scroll-fade-end` keyframes driven by the region's OWN scroll
 * (`component-layer-generators.ts`): a region with nothing to scroll has an
 * inactive timeline and draws no fade, and the fade lifts at the bottom.
 */
const SIDEBAR_NAV_LAYOUT =
  'flex min-h-0 flex-1 flex-col gap-0 overflow-auto pb-12 [animation-name:sv-scroll-fade-end] [animation-fill-mode:both] [animation-timing-function:linear] [animation-timeline:scroll(self)] group-data-[collapsible=icon]/sidebar:overflow-hidden'

/**
 * A declared landmark's `nav` around its groups: a plain column that never
 * shrinks. The navigation root is the one part that scrolls, so a landmark that
 * could shrink below its groups would let the next landmark draw over it.
 */
const SIDEBAR_LANDMARK_LAYOUT = 'flex w-full min-w-0 shrink-0 flex-col'

/**
 * One group (`sidebar-group`). A collapsible group draws no top padding, open
 * or shut, so its label stays on the same line when the disclosure toggles; a
 * shut one drops its bottom padding too, so it is one 32px row, and an open
 * one keeps the 8px under its entries. A rail, which forces every region open,
 * puts the padding back.
 */
const SIDEBAR_GROUP_LAYOUT =
  'relative flex w-full min-w-0 flex-col p-2 has-[>[data-slot=collapsible]]:pt-0 has-[>[data-slot=collapsible][data-state=closed]]:pb-0'

/** A group's heading (`sidebar-group-label`): small, medium, the foreground at 70 %. */
const SIDEBAR_GROUP_LABEL_CLASS =
  'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:-mt-8 group-data-[collapsible=icon]/sidebar:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0'

/** A group's `<ul>` (`sidebar-menu`). */
const SIDEBAR_GROUP_LIST_LAYOUT = 'flex w-full min-w-0 flex-col gap-0'

/** One nested `<li>` (`sidebar-menu-sub-item`). */
const SIDEBAR_MENU_SUB_ITEM_CLASS = 'group/menu-sub-item relative'

/** Compute the className for the sidebar box (`sidebar`), before the author's. */
export const computeSidebarBoxClasses = (): string => SIDEBAR_BOX_CLASS

/** Compute the className for the navigation root (`sidebar-content`). */
export const computeSidebarNavClasses = (): string => SIDEBAR_NAV_LAYOUT

/** Compute the className for a declared landmark's `nav` around its groups. */
export const computeSidebarLandmarkClasses = (): string => SIDEBAR_LANDMARK_LAYOUT

/** Compute the className for one labelled group block. */
export const computeSidebarGroupClasses = (): string => SIDEBAR_GROUP_LAYOUT

/**
 * Compute the className for a group heading.
 *
 * Under a rail it stops being painted below the breakpoint. A heading is the one
 * part of the navigation with no glyph to fall back on, so a 56px column would
 * otherwise carry a strip of clipped uppercase words between its icons. It is
 * unpainted rather than removed, for the reason the entry labels are: the
 * section is still named for a reader who never sees either.
 */
export const computeSidebarGroupLabelClasses = (
  below?: SidebarRailBreakpoint,
  drawer?: SidebarRailBreakpoint
): string =>
  below === undefined
    ? SIDEBAR_GROUP_LABEL_CLASS
    : `${SIDEBAR_GROUP_LABEL_CLASS} ${railClassesFor(below, drawer).heading}`

/** Compute the className for a group's `<ul>` of entries. */
export const computeSidebarGroupListClasses = (): string => SIDEBAR_GROUP_LIST_LAYOUT

// The `<li>` and the badge recipes live in a leaf module, re-exported here, so
// an island drawing a menu item (the `tree`) does not pay for this whole file.
export {
  computeSidebarEntryBadgeClasses,
  computeSidebarMenuItemClasses,
} from './sidebar-menu-default-classes'

/** Compute the className for one `<li>` of a nested list. */
export const computeSidebarMenuSubItemClasses = (): string => SIDEBAR_MENU_SUB_ITEM_CLASS

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR RAIL — `sidebar.rail: { below }`
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The breakpoint a rail names, read as a STRICT LOWER BOUND: the rail applies at
 * every width below it, and at it and above the sidebar renders exactly as it
 * does today. `mobile` is absent because it is the base rather than a
 * breakpoint — "below mobile" is the empty range, and the schema refuses it.
 */
export type SidebarRailBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/**
 * The three class lists a rail needs, spelled out per breakpoint.
 *
 * ## Why the rows are dressed from the ROOT
 *
 * A sidebar is drawn twice. The server draws the authored rows; two islands
 * redraw parts of it after hydration — the disclosure re-renders its whole
 * sub-list, and the fetched half of a group renders its rows for the first
 * time. A class threaded onto the SERVER's rows alone would leave a sidebar
 * that rails correctly with no JavaScript and paints full-width labels into a
 * 56px column the moment the chunk lands, which is the worst of the bugs
 * available here. A descendant rule on the navigation root reaches every row
 * either half draws, by construction and at no cost to the client bundle.
 *
 * `a>span` is the label AND the badge — both are direct span children of the
 * row, and the schema is explicit that the three consequences of a rail move
 * together or not at all.
 *
 * `sr-only`, never `hidden`: the label is hidden from the PAINT and never from
 * the document. An entry whose accessible name changed with the viewport is a
 * link that every deep link, runbook and assertion reaches at one width and at
 * no other while the page looks correct in both — and a row removed from the
 * layout takes its tab stop with it.
 *
 * ## Why the strings are literal
 *
 * The CSS compiler harvests its candidates from the source TEXT, so a class
 * assembled at runtime from a `max-${below}:` prefix emits no rule at all and a
 * rail declared against it paints nothing. `w-14` is 56px, and it is not an
 * author's choice: a navigation reduced to its glyphs has one legible width,
 * and letting a config re-decide it would re-proportion the icon column for one
 * sidebar.
 *
 * ## Why `button` is named beside `a`
 *
 * A top-level entry that declares no destination is one BUTTON carrying the
 * icon, the label, the badge and the chevron — the whole row, not an anchor with
 * a control beside it. Selecting only on `a` would leave exactly that row
 * painting a full-width label into a 56px column while every row around it
 * railed correctly, which is the shape of bug a rail is least likely to be
 * checked for. The small chevron button beside a LINK matches too and is
 * unaffected: it is already centred and has no direct `span` child to unpaint.
 */
interface RailClasses {
  readonly box: string
  readonly nav: string
  readonly heading: string
}

const RAIL_CLASSES: Record<SidebarRailBreakpoint, RailClasses> = {
  sm: {
    box: 'max-sm:w-14',
    nav: 'max-sm:[&_a]:justify-center max-sm:[&_a>span]:sr-only max-sm:[&_button]:justify-center max-sm:[&_button>span]:sr-only max-sm:[&_[data-sidebar-collapsible-content]]:block! max-sm:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'max-sm:sr-only',
  },
  md: {
    box: 'max-md:w-14',
    nav: 'max-md:[&_a]:justify-center max-md:[&_a>span]:sr-only max-md:[&_button]:justify-center max-md:[&_button>span]:sr-only max-md:[&_[data-sidebar-collapsible-content]]:block! max-md:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'max-md:sr-only',
  },
  lg: {
    box: 'max-lg:w-14',
    nav: 'max-lg:[&_a]:justify-center max-lg:[&_a>span]:sr-only max-lg:[&_button]:justify-center max-lg:[&_button>span]:sr-only max-lg:[&_[data-sidebar-collapsible-content]]:block! max-lg:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'max-lg:sr-only',
  },
  xl: {
    box: 'max-xl:w-14',
    nav: 'max-xl:[&_a]:justify-center max-xl:[&_a>span]:sr-only max-xl:[&_button]:justify-center max-xl:[&_button>span]:sr-only max-xl:[&_[data-sidebar-collapsible-content]]:block! max-xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'max-xl:sr-only',
  },
  '2xl': {
    box: 'max-2xl:w-14',
    nav: 'max-2xl:[&_a]:justify-center max-2xl:[&_a>span]:sr-only max-2xl:[&_button]:justify-center max-2xl:[&_button>span]:sr-only max-2xl:[&_[data-sidebar-collapsible-content]]:block! max-2xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'max-2xl:sr-only',
  },
}

/**
 * Compute the extra className the sidebar BOX takes on below a rail's
 * breakpoint — the fixed narrow width, which is what hands the difference back
 * to the surface the reader came for.
 *
 * An omitted rail returns the empty string, and every computer in this family
 * does: a sidebar declaring no rail renders exactly the classes it always did,
 * at every width.
 */
/**
 * The rail's classes when a DRAWER is declared beside it, keyed
 * `<drawer>-<rail>`.
 *
 * Below `drawer.below` the navigation leaves the page and reappears inside the
 * drawer, where it must read in full: a rail rule left on the `max-<rail>:`
 * range alone would still match at a phone width and paint the drawer's rows as
 * bare glyphs. So beside a drawer the rail holds the RANGE between the two
 * breakpoints, `<drawer>:max-<rail>:`, and nothing below it. Only the pairs the
 * boot rule accepts are listed — a drawer at or above its rail is refused
 * before a page renders — and they are spelled literally for the same reason
 * the rail's own rows are.
 */
const RAIL_BESIDE_DRAWER_CLASSES: Readonly<Record<string, RailClasses>> = {
  'sm-md': {
    box: 'sm:max-md:w-14',
    nav: 'sm:max-md:[&_a]:justify-center sm:max-md:[&_a>span]:sr-only sm:max-md:[&_button]:justify-center sm:max-md:[&_button>span]:sr-only sm:max-md:[&_[data-sidebar-collapsible-content]]:block! sm:max-md:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'sm:max-md:sr-only',
  },
  'sm-lg': {
    box: 'sm:max-lg:w-14',
    nav: 'sm:max-lg:[&_a]:justify-center sm:max-lg:[&_a>span]:sr-only sm:max-lg:[&_button]:justify-center sm:max-lg:[&_button>span]:sr-only sm:max-lg:[&_[data-sidebar-collapsible-content]]:block! sm:max-lg:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'sm:max-lg:sr-only',
  },
  'sm-xl': {
    box: 'sm:max-xl:w-14',
    nav: 'sm:max-xl:[&_a]:justify-center sm:max-xl:[&_a>span]:sr-only sm:max-xl:[&_button]:justify-center sm:max-xl:[&_button>span]:sr-only sm:max-xl:[&_[data-sidebar-collapsible-content]]:block! sm:max-xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'sm:max-xl:sr-only',
  },
  'sm-2xl': {
    box: 'sm:max-2xl:w-14',
    nav: 'sm:max-2xl:[&_a]:justify-center sm:max-2xl:[&_a>span]:sr-only sm:max-2xl:[&_button]:justify-center sm:max-2xl:[&_button>span]:sr-only sm:max-2xl:[&_[data-sidebar-collapsible-content]]:block! sm:max-2xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'sm:max-2xl:sr-only',
  },
  'md-lg': {
    box: 'md:max-lg:w-14',
    nav: 'md:max-lg:[&_a]:justify-center md:max-lg:[&_a>span]:sr-only md:max-lg:[&_button]:justify-center md:max-lg:[&_button>span]:sr-only md:max-lg:[&_[data-sidebar-collapsible-content]]:block! md:max-lg:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'md:max-lg:sr-only',
  },
  'md-xl': {
    box: 'md:max-xl:w-14',
    nav: 'md:max-xl:[&_a]:justify-center md:max-xl:[&_a>span]:sr-only md:max-xl:[&_button]:justify-center md:max-xl:[&_button>span]:sr-only md:max-xl:[&_[data-sidebar-collapsible-content]]:block! md:max-xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'md:max-xl:sr-only',
  },
  'md-2xl': {
    box: 'md:max-2xl:w-14',
    nav: 'md:max-2xl:[&_a]:justify-center md:max-2xl:[&_a>span]:sr-only md:max-2xl:[&_button]:justify-center md:max-2xl:[&_button>span]:sr-only md:max-2xl:[&_[data-sidebar-collapsible-content]]:block! md:max-2xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'md:max-2xl:sr-only',
  },
  'lg-xl': {
    box: 'lg:max-xl:w-14',
    nav: 'lg:max-xl:[&_a]:justify-center lg:max-xl:[&_a>span]:sr-only lg:max-xl:[&_button]:justify-center lg:max-xl:[&_button>span]:sr-only lg:max-xl:[&_[data-sidebar-collapsible-content]]:block! lg:max-xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'lg:max-xl:sr-only',
  },
  'lg-2xl': {
    box: 'lg:max-2xl:w-14',
    nav: 'lg:max-2xl:[&_a]:justify-center lg:max-2xl:[&_a>span]:sr-only lg:max-2xl:[&_button]:justify-center lg:max-2xl:[&_button>span]:sr-only lg:max-2xl:[&_[data-sidebar-collapsible-content]]:block! lg:max-2xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'lg:max-2xl:sr-only',
  },
  'xl-2xl': {
    box: 'xl:max-2xl:w-14',
    nav: 'xl:max-2xl:[&_a]:justify-center xl:max-2xl:[&_a>span]:sr-only xl:max-2xl:[&_button]:justify-center xl:max-2xl:[&_button>span]:sr-only xl:max-2xl:[&_[data-sidebar-collapsible-content]]:block! xl:max-2xl:[&_[data-slot=sidebar-group]]:py-2!',
    heading: 'xl:max-2xl:sr-only',
  },
}

/** The rail row that applies, given the drawer (if any) declared beside it. */
const railClassesFor = (
  below: SidebarRailBreakpoint,
  drawer: SidebarRailBreakpoint | undefined
): RailClasses =>
  (drawer === undefined ? undefined : RAIL_BESIDE_DRAWER_CLASSES[`${drawer}-${below}`]) ??
  RAIL_CLASSES[below]

export const computeSidebarRailBoxClasses = (
  below: SidebarRailBreakpoint | undefined,
  drawer: SidebarRailBreakpoint | undefined = undefined
): string => (below === undefined ? '' : railClassesFor(below, drawer).box)

/**
 * Compute the extra className the navigation ROOT takes on for a rail: centre
 * every glyph, and stop painting anything a reader would read.
 */
export const computeSidebarRailNavClasses = (
  below: SidebarRailBreakpoint | undefined,
  drawer: SidebarRailBreakpoint | undefined = undefined
): string => (below === undefined ? '' : railClassesFor(below, drawer).nav)

// The rows, the disclosures and the drawer live in leaf modules, re-exported
// here so every importer keeps reaching them through this facade.
export {
  computeSidebarDisclosureChevronClasses,
  computeSidebarDisclosureListClasses,
  computeSidebarDisclosureRowClasses,
  computeSidebarDisclosureStateClasses,
  computeSidebarDisclosureToggleClasses,
  computeSidebarEntryClasses,
  computeSidebarSubEntryClasses,
  computeSidebarToggleChevronSlotClasses,
  computeSidebarToggleLabelClasses,
  computeSidebarToggleRowClasses,
} from './sidebar-entry-default-classes'
export {
  computeSidebarDrawerBodyClasses,
  computeSidebarDrawerContentClasses,
  computeSidebarDrawerHeaderClasses,
  computeSidebarDrawerPanelClasses,
  computeSidebarDrawerSeparatorClasses,
  computeSidebarDrawerTriggerClasses,
} from './sidebar-drawer-default-classes'
