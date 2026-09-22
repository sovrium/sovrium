/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `sidebar` component's navigation
 * — groups, entries, badges and disclosures (wave R-F).
 *
 * ## Why it moved here
 * The sidebar is drawn TWICE. The server draws it in
 * `ui/sections/rendering/component-registry/sidebar-{entry,groups}.tsx` (a
 * `presentation-component`); the browser redraws parts of it in three islands
 * under `islands/navigation/` — the disclosure re-renders its whole child list
 * after a fetch, the groups island re-renders a collapsed rail, the current
 * island re-marks a row after an SPA navigation. `[internal ref]`
 * forbids BOTH directions across that seam, so until this wave the island half
 * carried a HAND-COPY of these class strings in `sidebar-entry-classes.ts` and
 * in `sidebar-disclosure-island.tsx`, under a comment saying "changing one means
 * changing the other".
 *
 * They had already drifted. `presentation-util` is the one tree both sides may
 * import (the `button-default-classes.ts` precedent from F1, and the seven data
 * views from R-D), so the vocabulary lives here once and the copies are gone.
 *
 * ## Safelist
 * `src/presentation/utils/recipes` is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`), so the `v(…)` template
 * literals below are resolved at build time into the compiler's
 * `@source inline(...)` safelist. A recipe whose arbitrary classes are NOT
 * safelisted emits no rule at all and paints nothing.
 *
 * ## Colour / layout split
 * Colour and radius go through {@link withVarFallback} so an `app.design.*`
 * override still wins at the cascade layer; layout, spacing and type steps stay
 * raw Tailwind because they encode structure, not colour.
 *
 * ## Type steps
 * Every size is a rung of the platform ladder: 14px is `text-md`, 12px is
 * `text-sm`, 11px is `text-xs`. No arbitrary `text-[Npx]`.
 *
 * Parts covered:
 *
 *   - NAV               — the `<nav>` landmark stacking the groups
 *   - GROUP             — one labelled section
 *   - GROUP LABEL       — its uppercase heading
 *   - GROUP LIST        — the `<ul>` of rows inside it
 *   - ENTRY             — a top-level row; `current` axis
 *   - SUB ENTRY         — a row a disclosure reveals, at either depth
 *   - ENTRY BADGE       — the literal marker or fetched count after a label
 *   - DISCLOSURE ROW    — the grid holding link, toggle and revealed list
 *   - DISCLOSURE TOGGLE — the small square target beside the link
 *   - TOGGLE ROW        — the whole row as one control, when it has no href
 *   - DISCLOSURE CHEVRON— the 12px direction mark inside it
 *   - DISCLOSURE LIST   — the indented, rule-led `<ul>` it governs
 *   - DISCLOSURE STATE  — the loading / empty / error line of a fetched list
 *
 * ## Tone rule
 * A grey lighter than `fg-subtle` is legal only on a mark carrying NO content
 * — a chevron, a rule. Anything a reader has to READ stops at `fg-subtle`. That
 * is why an entry label is full-strength ink with only its ICON muted, and why
 * the chevron is the one thing here allowed to be `fg-disabled`. Stated in full
 * on `navigation-default-classes.ts`, the other half of this family.
 *
 * Canvas oracle: `chrome.mjs` `.nav` `.ngap` `.nhead` `.ni` `.nkids` `.nk`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR GROUPS — heading / list / entry
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The gap between GROUPS is a whole step; the gap inside one is 2px.
 *
 * That asymmetry is the whole grouping mechanism in a sidebar with no rules
 * and no boxes: rows inside a section nearly touch, sections stand a full
 * 16px apart, and the uppercase label sits in that gap. Widening the inner gap
 * (it was 4px) makes the two distances comparable and the sections stop
 * reading as sections.
 */
const SIDEBAR_NAV_LAYOUT = 'flex flex-col gap-4'

const SIDEBAR_GROUP_LAYOUT = 'flex flex-col gap-0.5'

const SIDEBAR_GROUP_LABEL_CLASS = [
  'px-2 py-1 text-xs font-medium tracking-wide uppercase',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

const SIDEBAR_GROUP_LIST_LAYOUT = 'flex flex-col gap-0.5'

/**
 * An entry label is INK; only its icon is muted.
 *
 * The row was muted end to end, which made every destination in the console
 * read as secondary and left the current one to be found by its fill alone.
 * The reference puts the label at full strength and mutes the GLYPH — so the
 * icon column reads as a quiet index down the left edge and the labels read as
 * what they are, the list of places this app has.
 *
 * The `[&>svg]` selector rather than a class on the icon: the icon is emitted
 * by the shared icon renderer from a configured name, and it has no seam for a
 * per-surface class. Reaching it from the row is what keeps the tone a property
 * of the SIDEBAR rather than of every icon everywhere.
 */
const SIDEBAR_ENTRY_CLASS = [
  'flex items-center gap-2',
  'rounded-md px-2 py-1.5 text-md transition-colors',
  `text-[${v('sv-fg', T.fg)}]`,
  `[&>svg]:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * The entry for the page currently being viewed. Full-strength foreground on a
 * subtle fill, so the mark is legible without relying on colour alone — the
 * entry also carries `aria-current="page"`, which is what answers "where am I"
 * for a reader who never sees either.
 */
const SIDEBAR_ENTRY_CURRENT_CLASS = [
  SIDEBAR_ENTRY_CLASS,
  'font-medium',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * A SUB-entry — the second and third levels a disclosure reveals.
 *
 * One step quieter than its parent and one pixel tighter, which is the only
 * thing separating the two levels once the indent rule has already said where
 * they sit. It carries the same fill and the same weight when current, so the
 * "you are here" mark reads identically at every depth.
 */
const SIDEBAR_SUB_ENTRY_CLASS = [
  'flex items-center gap-2',
  'rounded-md px-2 py-[5px] text-md transition-colors',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const SIDEBAR_SUB_ENTRY_CURRENT_CLASS = [
  SIDEBAR_SUB_ENTRY_CLASS,
  'font-medium',
  `text-[${v('sv-fg', T.fg)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * The marker beside an entry label: a literal ("Beta") or a fetched count.
 * Small, muted and bordered so it reads as metadata rather than as a second
 * label competing with the entry's own.
 */
const SIDEBAR_ENTRY_BADGE_CLASS = [
  'ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs leading-[1.3]',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the className for the sidebar's `<nav>` landmark — the column that
 * stacks every group. Layout only: the surrounding `sidebar` box owns the
 * chrome, so a grouped sidebar sits inside whatever the author styled without
 * a second background fighting it.
 */
export const computeSidebarNavClasses = (): string => SIDEBAR_NAV_LAYOUT

/** Compute the className for one labelled group block. */
export const computeSidebarGroupClasses = (): string => SIDEBAR_GROUP_LAYOUT

/**
 * Compute the className for a group heading. Subtle, uppercase and small: a
 * heading here is chrome that separates entries, never a peer of the entries
 * it labels.
 *
 * Under a rail it stops being painted below the breakpoint. A heading is the one
 * part of the navigation with no glyph to fall back on, so a 56px column would
 * otherwise carry a strip of clipped uppercase words between its icons. It is
 * unpainted rather than removed, for the reason the entry labels are: the
 * section is still named for a reader who never sees either.
 */
export const computeSidebarGroupLabelClasses = (below?: SidebarRailBreakpoint): string =>
  below === undefined
    ? SIDEBAR_GROUP_LABEL_CLASS
    : `${SIDEBAR_GROUP_LABEL_CLASS} ${RAIL_CLASSES[below].heading}`

/** Compute the className for a group's `<ul>` of entries. */
export const computeSidebarGroupListClasses = (): string => SIDEBAR_GROUP_LIST_LAYOUT

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
const RAIL_CLASSES: Record<
  SidebarRailBreakpoint,
  { readonly box: string; readonly nav: string; readonly heading: string }
> = {
  sm: {
    box: 'max-sm:w-14',
    nav: 'max-sm:[&_a]:justify-center max-sm:[&_a>span]:sr-only max-sm:[&_button]:justify-center max-sm:[&_button>span]:sr-only',
    heading: 'max-sm:sr-only',
  },
  md: {
    box: 'max-md:w-14',
    nav: 'max-md:[&_a]:justify-center max-md:[&_a>span]:sr-only max-md:[&_button]:justify-center max-md:[&_button>span]:sr-only',
    heading: 'max-md:sr-only',
  },
  lg: {
    box: 'max-lg:w-14',
    nav: 'max-lg:[&_a]:justify-center max-lg:[&_a>span]:sr-only max-lg:[&_button]:justify-center max-lg:[&_button>span]:sr-only',
    heading: 'max-lg:sr-only',
  },
  xl: {
    box: 'max-xl:w-14',
    nav: 'max-xl:[&_a]:justify-center max-xl:[&_a>span]:sr-only max-xl:[&_button]:justify-center max-xl:[&_button>span]:sr-only',
    heading: 'max-xl:sr-only',
  },
  '2xl': {
    box: 'max-2xl:w-14',
    nav: 'max-2xl:[&_a]:justify-center max-2xl:[&_a>span]:sr-only max-2xl:[&_button]:justify-center max-2xl:[&_button>span]:sr-only',
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
export const computeSidebarRailBoxClasses = (below: SidebarRailBreakpoint | undefined): string =>
  below === undefined ? '' : RAIL_CLASSES[below].box

/**
 * Compute the extra className the navigation ROOT takes on for a rail: centre
 * every glyph, and stop painting anything a reader would read.
 */
export const computeSidebarRailNavClasses = (below: SidebarRailBreakpoint | undefined): string =>
  below === undefined ? '' : RAIL_CLASSES[below].nav

/**
 * Compute the className for a single top-level navigation entry `<a>`. Ink
 * label, muted glyph, subtle fill and medium weight when current.
 */
export const computeSidebarEntryClasses = (isCurrent = false): string =>
  isCurrent ? SIDEBAR_ENTRY_CURRENT_CLASS : SIDEBAR_ENTRY_CLASS

/**
 * Compute the className for a nested navigation entry `<a>` — anything a
 * disclosure reveals, at either depth.
 */
export const computeSidebarSubEntryClasses = (isCurrent = false): string =>
  isCurrent ? SIDEBAR_SUB_ENTRY_CURRENT_CLASS : SIDEBAR_SUB_ENTRY_CLASS

/** Compute the className for an entry's badge (literal marker or live count). */
export const computeSidebarEntryBadgeClasses = (): string => SIDEBAR_ENTRY_BADGE_CLASS

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR DISCLOSURE — expandable entry: row / toggle / child list / states
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The row holding an expandable entry's link and its toggle.
 *
 * A two-column grid rather than a flex row, because the child LIST is a third
 * item that has to sit BELOW both and span them. The island host between them
 * carries `display: contents`, so the button and the list it renders become
 * direct items of this grid rather than of a wrapper the layout would have to
 * work around.
 */
const SIDEBAR_DISCLOSURE_ROW_LAYOUT = 'grid grid-cols-[1fr_auto] items-center gap-0.5'

/**
 * The toggle beside an expandable entry's link.
 *
 * Deliberately a small square target NEXT to the link rather than a wrapper
 * around it: the entry label stays a real link to its own page, so the reader
 * can open the destination as readily as the list of its parts.
 */
const SIDEBAR_DISCLOSURE_TOGGLE_CLASS = [
  'flex size-6 shrink-0 items-center justify-center',
  'rounded-md transition-colors',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * The WHOLE row as one toggle — an entry that declares no destination.
 *
 * It takes the ordinary entry's geometry and tone, and the difference from
 * {@link SIDEBAR_ENTRY_CLASS} is entirely in what it does NOT have: there is no
 * `current` variant, and there never will be. `aria-current` says "this is the
 * page you are on", and a row that goes nowhere is not a page — so a selected
 * fill here would be the same lie in colour that the mark is in the
 * accessibility tree. Hover is the only state it answers to.
 *
 * `col-span-2` because it replaces BOTH cells of the disclosure grid: the link
 * and the small chevron beside it have become one control, and the list below
 * still spans the same two columns.
 *
 * `text-left` because a button centres its text and this row is a navigation
 * entry, which reads down a left edge with its siblings.
 *
 * `[&>svg]` mutes the LEADING icon and reaches nothing else, because the chevron
 * travels wrapped in {@link SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS}. That wrapper is
 * not decoration: a bare chevron would be a second direct `svg` child, the
 * descendant rule would out-specify its own `fg-disabled` tone, and the mark the
 * tone rule above reserves the lightest grey for would quietly darken to match
 * the icons.
 */
const SIDEBAR_TOGGLE_ROW_CLASS = [
  'col-span-2 flex w-full items-center gap-2',
  'rounded-md px-2 py-1.5 text-left text-md transition-colors',
  `text-[${v('sv-fg', T.fg)}]`,
  `[&>svg]:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * The label inside a toggle row, which GROWS.
 *
 * One mechanism pushes the badge and the chevron to the right edge, rather than
 * an `ml-auto` on each of them — two auto margins in one flex row split the free
 * space between themselves, which would leave a badged toggle with a gap in the
 * middle of it and the chevron adrift.
 */
const SIDEBAR_TOGGLE_LABEL_CLASS = 'flex-1'

/**
 * The chevron's slot in a toggle row: a wrapper, for the two reasons
 * {@link SIDEBAR_TOGGLE_ROW_CLASS} gives — it keeps the row's icon rule off the
 * chevron, and it makes the chevron a `span` the rail can stop painting along
 * with the label and the badge.
 */
const SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS = 'flex shrink-0 items-center'

/**
 * The chevron inside the toggle: rotated a quarter turn while open.
 *
 * 12px, not 16. A chevron is a DIRECTION rather than an object, and drawn at
 * the same size as the destination icons on the other side of the row it
 * competes with them — the reference draws every chevron and check at 12px
 * against a 16px icon set for exactly that reason. Its tone is the lightest in
 * the system because it carries no content at all.
 */
const SIDEBAR_DISCLOSURE_CHEVRON_CLASS = [
  'size-3 transition-transform duration-150',
  `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
].join(' ')

/**
 * The sub-entry list a disclosure reveals.
 *
 * Indented and rule-led so the nesting is legible without relying on the reader
 * having noticed which toggle they opened.
 */
const SIDEBAR_DISCLOSURE_LIST_CLASS = [
  'col-span-2 mt-0.5 ml-[15px] flex flex-col gap-0.5 border-l pl-2',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/** The loading / empty / error line standing in for a fetched list. */
const SIDEBAR_DISCLOSURE_STATE_CLASS = [
  'px-2 py-[5px] text-sm',
  `text-[${v('sv-fg-subtle', T.fgSubtle)}]`,
].join(' ')

/** Compute the className for an expandable entry's row (link + toggle + list). */
export const computeSidebarDisclosureRowClasses = (): string => SIDEBAR_DISCLOSURE_ROW_LAYOUT

/** Compute the className for a disclosure's toggle button. */
export const computeSidebarDisclosureToggleClasses = (): string => SIDEBAR_DISCLOSURE_TOGGLE_CLASS

/**
 * Compute the className for a whole row that IS the toggle — an entry declaring
 * no destination. Hover only: it has no current state, by construction.
 */
export const computeSidebarToggleRowClasses = (): string => SIDEBAR_TOGGLE_ROW_CLASS

/** Compute the className for the growing label inside a toggle row. */
export const computeSidebarToggleLabelClasses = (): string => SIDEBAR_TOGGLE_LABEL_CLASS

/** Compute the className for the chevron's wrapper inside a toggle row. */
export const computeSidebarToggleChevronSlotClasses = (): string =>
  SIDEBAR_TOGGLE_CHEVRON_SLOT_CLASS

/** Compute the className for a disclosure's chevron, rotated while open. */
export const computeSidebarDisclosureChevronClasses = (expanded = false): string =>
  expanded ? `${SIDEBAR_DISCLOSURE_CHEVRON_CLASS} rotate-90` : SIDEBAR_DISCLOSURE_CHEVRON_CLASS

/** Compute the className for a disclosure's sub-entry list. */
export const computeSidebarDisclosureListClasses = (): string => SIDEBAR_DISCLOSURE_LIST_CLASS

/** Compute the className for a fetched list's loading, empty or error line. */
export const computeSidebarDisclosureStateClasses = (): string => SIDEBAR_DISCLOSURE_STATE_CLASS
