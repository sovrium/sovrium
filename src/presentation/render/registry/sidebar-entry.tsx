/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeSidebarDisclosureListClasses,
  computeSidebarDisclosureRowClasses,
  computeSidebarDisclosureStateClasses,
  computeSidebarEntryClasses,
  computeSidebarSubEntryClasses,
  type SidebarRailBreakpoint,
} from '@/presentation/design/sidebar-default-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import {
  CURRENT_ENTRY_KEY,
  CURRENT_SECTION_KEY,
} from '@/presentation/render/resolve/sidebar-current-resolver'
import { renderIcon } from '../elements/icon-renderer'
import { resolveChildTranslation } from '../i18n/translation-handler'
import {
  railTitle,
  renderBadge,
  renderChevronToggle,
  renderToggleRow,
  toggleRowPayload,
  type DisclosureState,
} from './sidebar-entry-parts'
import type { Languages } from '@/domain/models/app/languages'
import type {
  SidebarLeafItem,
  SidebarNavItem,
  SidebarSubItem,
} from '@/domain/models/app/pages/components/component-types/layout/sidebar'

/** The language context every user-facing string in the sidebar resolves against. */
export interface SidebarI18n {
  readonly currentLang: string | undefined
  readonly languages: Languages | undefined
}

/** Default toggle names, both carrying the `{label}` a fixed string cannot. */
const DEFAULT_EXPAND_LABEL = 'Expand {label}'
const DEFAULT_COLLAPSE_LABEL = 'Collapse {label}'

/** Default copy for the three states only a FETCHED child list can be in. */
const DEFAULT_LOADING_LABEL = 'Loading…'
const DEFAULT_ERROR_LABEL = "Couldn't load the list."
const DEFAULT_EMPTY_LABEL = 'No items.'

/** Whether the entry expands at all — authored children, or fetched ones. */
export const isExpandable = (item: SidebarNavItem): boolean =>
  item.children !== undefined || item.source !== undefined

/**
 * A DOM id for the list a toggle governs.
 *
 * `aria-controls` is what lets a screen reader jump from the toggle to the rows
 * it opened, and it needs a real id — so the id has to survive being written
 * into a CSS selector. An href carries slashes, which do not, hence the
 * sanitising pass and the constant prefix that keeps the result a legal
 * identifier however the href began.
 *
 * A TOGGLE entry has no href — it goes nowhere, which is the whole point of it —
 * so the seed falls back to the label. Unreachable for an entry that declares a
 * destination, so every id this has ever produced is unchanged; and the trailing
 * index keeps the result unique whatever the seed collapses to, which it already
 * had to, since a non-ASCII href sanitises down to a run of dashes too.
 */
export const disclosureListId = (item: SidebarNavItem, index: number): string =>
  `sbd-${(item.href ?? item.label).replaceAll(/[^A-Za-z0-9_-]/g, '-')}-${index}`

/**
 * One entry: a real link, with its icon inline before the label, its badge
 * after it, and `aria-current="page"` when it is the page being viewed.
 *
 * The mark is resolved server-side by `resolveSidebarCurrentEntries` — a
 * navigation that only knows where it is after hydration has told a
 * screen-reader user nothing.
 *
 * `data-sidebar-entry` and `data-active-match` are what let the client tracker
 * re-derive that mark after a same-document navigation WITHOUT re-rendering the
 * link: the anchor stays server-owned, icon and badge island included.
 */
/**
 * The island prop that carries a rail across hydration.
 *
 * A boolean rather than the breakpoint: everything the rail PAINTS is a
 * descendant rule on the navigation root, which reaches an island's rows on its
 * own, so all an island still needs to know is whether to hang a tooltip on a
 * row it draws.
 */
export const railFlag = (
  rail: SidebarRailBreakpoint | undefined
): Readonly<Record<string, boolean>> => (rail === undefined ? {} : { rail: true })

export function renderEntry(
  item: SidebarNavItem | SidebarSubItem | SidebarLeafItem,
  i18n: SidebarI18n,
  /**
   * Whether this row is NESTED — anything a disclosure reveals, at either
   * depth. A nested row is one tone quieter and one pixel tighter than a
   * top-level one, which is what separates the levels once the indent rule has
   * already said where they sit. Passed rather than derived: at this point a
   * `SidebarSubItem` and a top-level `SidebarNavItem` are the same shape, so
   * only the CALLER knows which list the row is in.
   */
  isNested = false,
  /**
   * The breakpoint below which this row's sidebar is a rail, or `undefined`
   * when it declares none.
   *
   * Only the TOOLTIP needs it. Everything the rail paints — the fixed width, the
   * unpainted label and badge, the centred glyph — is a descendant rule on the
   * navigation root, so it reaches the rows the two islands redraw as readily as
   * these. A `title` is an attribute rather than a paint and no rule can add it.
   */
  rail: SidebarRailBreakpoint | undefined = undefined
): ReactElement {
  const label = resolveChildTranslation(item.label, i18n.currentLang, i18n.languages)
  const isCurrent = (item as Record<string, unknown>)[CURRENT_ENTRY_KEY] === true
  const authoredTitle = (item.props as Record<string, unknown> | undefined)?.['title']
  return (
    // The authored bag is spread FIRST, so every attribute the renderer owns is
    // written after it and cannot be displaced. A key it must not set is already
    // refused at boot by `sidebarNavigationViolations` — which names both the key
    // and the entry, where a silently dropped attribute would name neither — and
    // this ordering is the second line under that.
    <a
      {...(item.props ?? {})}
      href={item.href}
      data-sidebar-entry=""
      data-active-match={item.activeMatch ?? 'exact'}
      className={
        isNested ? computeSidebarSubEntryClasses(isCurrent) : computeSidebarEntryClasses(isCurrent)
      }
      {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
      {...railTitle(rail, label, authoredTitle)}
    >
      {item.icon !== undefined &&
        renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])}
      <span>{label}</span>
      {renderBadge((item as SidebarNavItem).badge)}
    </a>
  )
}

/** A leaf or sub-entry as the island will re-render it: labels resolved, icon as geometry. */
function toIslandChild(
  child: SidebarSubItem | SidebarLeafItem,
  i18n: SidebarI18n
): Record<string, unknown> {
  const nested = (child as SidebarSubItem).children
  return {
    label: resolveChildTranslation(child.label, i18n.currentLang, i18n.languages),
    href: child.href,
    activeMatch: child.activeMatch ?? 'exact',
    // Resolved HERE, where the icon set is already in the binary. Handing the
    // island a NAME instead would make it reach `lucide-resolver`, whose
    // namespace import is unshakeable and costs the browser 668 KB.
    ...(child.icon === undefined ? {} : { iconNode: resolveLucideIconNode(child.icon) }),
    ...(child.props === undefined ? {} : { props: child.props }),
    // The row's marker, carried through hydration for the same reason
    // `subItems` below is. `badge` is on the entry bag every level spreads, so a
    // row at ANY depth may declare one — and every one of those rows is redrawn
    // by the island. Both branches travel: the literal because the island writes
    // it, and the endpoint because the island mounts the count itself. Kept in
    // the schema's own shape rather than normalised, so the island's two
    // branches read as the server's two do.
    ...(child.badge === undefined ? {} : { badge: child.badge }),
    // The third level, carried through hydration. The level-2 disclosure IS an
    // island wherever a sidebar has one, so the island re-renders this list —
    // omit it here and the nested rows the server drew vanish the moment the
    // chunk lands, which is the worst of the three possible bugs: correct
    // without JavaScript and broken with it.
    //
    // Named `subItems` and never `children`, for the reason the disclosure's own
    // payload gives: island props are spread onto the component, and React
    // would read a `children` key as the element's own children.
    ...(nested === undefined ? {} : { subItems: nested.map((leaf) => toIslandChild(leaf, i18n)) }),
    ...((child as SidebarSubItem).childrenProps === undefined
      ? {}
      : { childrenProps: (child as SidebarSubItem).childrenProps }),
    current: (child as Record<string, unknown>)[CURRENT_ENTRY_KEY] === true,
  }
}

/**
 * An expandable entry: its link, its toggle, and the list the toggle governs.
 *
 * ─── WHY THE LINK STAYS OUTSIDE THE ISLAND ─────────────────────────────────
 *
 * Turning the whole row into an island would hand the browser the entry's icon
 * and its badge island as well, and make the destination itself depend on a
 * chunk having loaded. The link is therefore server-rendered exactly as an
 * unexpandable entry's is, and the island owns only the two things that cannot
 * work without JavaScript: the toggle and the list.
 *
 * That split needs the two halves to share a grid, which is why the host span
 * carries `display: contents` — it disappears from layout and lets the button
 * sit beside the link while the list it renders spans the row below.
 *
 * The SSR fallback inside the host is a complete, correct disclosure: a toggle
 * carrying the right name and state, and — when the reader arrived INSIDE this
 * section — the open list with its current child already marked. A reader with
 * no JavaScript gets a navigation that has told them where they are.
 */
/** Resolve a copy field, falling back to the default this component ships. */
const copy = (value: string | undefined, fallback: string, i18n: SidebarI18n): string =>
  resolveChildTranslation(value ?? fallback, i18n.currentLang, i18n.languages)

/**
 * Everything the island needs to re-render this disclosure itself.
 *
 * Every user-facing string is resolved HERE, so a `$t:` key never reaches the
 * browser and the island carries no translation machinery. The three fetched-list
 * states are given their defaults here for the same reason.
 *
 * A TOGGLE entry — one declaring no `href` — additionally hands over the row's
 * own icon, badge and authored attribute bag; see {@link toggleRowPayload} for
 * why a LINKED parent hands over none of the three.
 */
function buildIslandProps(
  item: SidebarNavItem,
  i18n: SidebarI18n,
  state: DisclosureState,
  trackNavigation: boolean
): Record<string, unknown> {
  const { source } = item
  return {
    listId: state.listId,
    // The row rules reach the island's rows from the navigation root; the
    // TOOLTIP cannot, because it is an attribute rather than a paint. Absent
    // unless a rail is declared, so a sidebar that declares none serialises
    // exactly the props it always did.
    ...railFlag(state.rail),
    label: state.label,
    // Absent rather than `undefined` for a toggle: `JSON.stringify` drops an
    // undefined value anyway, so spelling it conditionally is what keeps the
    // payload a LINKED parent serialises byte-for-byte the one it always did.
    ...(item.href === undefined ? {} : { href: item.href }),
    ...(item.href !== undefined ? {} : toggleRowPayload(item)),
    activeMatch: item.activeMatch ?? 'exact',
    expandLabel: state.expandLabel,
    collapseLabel: state.collapseLabel,
    expanded: state.expanded,
    sectionCurrent: state.sectionCurrent,
    track: trackNavigation,
    // Named `subItems`, never `children`: island props are spread onto the
    // component, and a `children` key would be read by React as the element's
    // own children and render the sub-entries as raw objects.
    ...(item.children === undefined
      ? {}
      : { subItems: item.children.map((child) => toIslandChild(child, i18n)) }),
    ...(item.childrenProps === undefined ? {} : { childrenProps: item.childrenProps }),
    ...(source === undefined
      ? {}
      : {
          source: {
            endpoint: source.endpoint,
            rowsKey: source.rowsKey ?? 'items',
            labelKey: source.labelKey,
            hrefTemplate: source.hrefTemplate,
            ...(source.itemProps === undefined ? {} : { itemProps: source.itemProps }),
            // `query` travels as its OWN prop rather than pre-appended to the
            // endpoint, exactly as a GROUP's source carries it
            // (`sidebar-groups.tsx`): the island hands `{ endpoint, query }` to
            // `buildSystemQueryUrl` and one helper owns the merge, so the shape
            // the schema shares has one spelling across every consumer.
            ...(source.query === undefined ? {} : { query: source.query }),
            loadingLabel: copy(source.loadingLabel, DEFAULT_LOADING_LABEL, i18n),
            errorLabel: copy(source.errorLabel, DEFAULT_ERROR_LABEL, i18n),
            emptyLabel: copy(source.emptyLabel, DEFAULT_EMPTY_LABEL, i18n),
          },
        }),
  }
}

/**
 * The open list, server-rendered.
 *
 * A fetched list has nothing to show before the island has asked for it, so it
 * renders its own loading line — which is also what a reader without JavaScript
 * is left with, and honest: the rows genuinely are not there.
 */
function renderOpenList(
  item: SidebarNavItem,
  i18n: SidebarI18n,
  listId: string,
  rail: SidebarRailBreakpoint | undefined
): ReactElement | undefined {
  if (item.children === undefined && item.source === undefined) return undefined
  return (
    <ul
      className={computeSidebarDisclosureListClasses()}
      id={listId}
      {...(item.childrenProps ?? {})}
    >
      {item.children === undefined ? (
        <li className={computeSidebarDisclosureStateClasses()}>
          {copy(item.source?.loadingLabel, DEFAULT_LOADING_LABEL, i18n)}
        </li>
      ) : (
        item.children.map((child, index) => (
          <li key={`${child.href}-${index}`}>
            {renderEntry(child, i18n, true, rail)}
            {renderNestedList(child, i18n, rail)}
          </li>
        ))
      )}
    </ul>
  )
}

/**
 * A sub-entry's OWN list: the third level, always open and carrying no toggle.
 *
 * ─── WHY IT IS NOT A SECOND DISCLOSURE ─────────────────────────────────────
 *
 * A toggle inside a toggle needs an accessible name saying which of two
 * nestings it operates, and there is no brief wording that does. And the level
 * is already gated by WHERE the reader is — it exists to be paired with
 * `showWhen`, so by the time these rows are in the document the reader is
 * looking at the page they belong to, and a second gesture to reveal them is a
 * gesture with no decision behind it.
 *
 * So it is a plain nested `<ul>` inside the sub-entry's own `<li>`. It reuses
 * the disclosure list's classes deliberately: the indent is relative to its
 * container, so nesting the same recipe inside a list that already carries it
 * steps in once more without a second recipe to keep in step. (`col-span-2` is
 * inert here — the `<li>` is not the disclosure row's grid.)
 *
 * `childrenProps` is the only way to name this element, since a leaf's own
 * `props` names one row and nothing names the set.
 */
function renderNestedList(
  child: SidebarSubItem,
  i18n: SidebarI18n,
  rail: SidebarRailBreakpoint | undefined
): ReactElement | undefined {
  const { children } = child
  if (children === undefined || children.length === 0) return undefined
  return (
    <ul
      className={computeSidebarDisclosureListClasses()}
      {...(child.childrenProps ?? {})}
    >
      {children.map((leaf, index) => (
        <li key={`${leaf.href}-${index}`}>{renderEntry(leaf, i18n, true, rail)}</li>
      ))}
    </ul>
  )
}

/**
 * An expandable entry: its link, its toggle, and the list the toggle governs.
 *
 * ─── WHY THE LINK STAYS OUTSIDE THE ISLAND ─────────────────────────────────
 *
 * Turning the whole row into an island would hand the browser the entry's icon
 * and its badge island as well, and make the destination itself depend on a
 * chunk having loaded. The link is therefore server-rendered exactly as an
 * unexpandable entry's is, and the island owns only the two things that cannot
 * work without JavaScript: the toggle and the list.
 *
 * That split needs the two halves to share a grid, which is why the host span
 * carries `display: contents` — it disappears from layout and lets the button
 * sit beside the link while the list it renders spans the row below.
 *
 * The SSR fallback inside the host is a COMPLETE, correct disclosure: a toggle
 * carrying the right name and state, and — when the reader arrived INSIDE this
 * section — the open list with its current child already marked. A reader with
 * no JavaScript still gets a navigation that has told them where they are.
 *
 * ─── AND WHEN THERE IS NO LINK ─────────────────────────────────────────────
 *
 * An entry that declares no `href` has no destination to keep outside the
 * island, so the whole row becomes one button and that button moves INSIDE the
 * host — `renderToggleRow` states the reasoning. Everything around it is
 * unchanged: the same grid, the same host, the same list below.
 */
export function renderDisclosureEntry(
  item: SidebarNavItem,
  i18n: SidebarI18n,
  listId: string,
  /**
   * The two things a disclosure needs from the sidebar around it, passed as one
   * bag so the signature stays inside the four-parameter cap the linter holds
   * every renderer to.
   */
  {
    trackNavigation,
    rail,
  }: { readonly trackNavigation: boolean; readonly rail?: SidebarRailBreakpoint }
): ReactElement {
  const sectionCurrent = (item as Record<string, unknown>)[CURRENT_SECTION_KEY] === true
  const label = resolveChildTranslation(item.label, i18n.currentLang, i18n.languages)
  const state: DisclosureState = {
    listId,
    label,
    expandLabel: copy(item.expandLabel, DEFAULT_EXPAND_LABEL, i18n),
    collapseLabel: copy(item.collapseLabel, DEFAULT_COLLAPSE_LABEL, i18n),
    // Open on arrival when the reader is already inside this section — an
    // operator who deep-links into an object should see its siblings without a
    // second click — or when the author asked for it outright.
    expanded: item.defaultExpanded === true || sectionCurrent,
    sectionCurrent,
    ...(rail === undefined ? {} : { rail }),
  }
  // An entry with no destination is a TOGGLE: the whole row is the control, so
  // there is no anchor outside the host and no separate chevron inside it.
  const isToggle = item.href === undefined
  return (
    <div className={computeSidebarDisclosureRowClasses()}>
      {!isToggle && renderEntry(item, i18n, false, rail)}
      <span
        className="contents"
        data-island="sidebar-disclosure"
        data-island-props={JSON.stringify(buildIslandProps(item, i18n, state, trackNavigation))}
      >
        {isToggle ? renderToggleRow(item, state) : renderChevronToggle(state)}
        {state.expanded && renderOpenList(item, i18n, listId, rail)}
      </span>
    </div>
  )
}
