/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { idSourceForLabel, localizeChildLabel, slugifyLabel } from './island-child-label'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

export function buildTabsItems(
  rawPanels: unknown,
  renderedChildren: readonly ReactElement[],
  currentLang: string | undefined,
  languages: Languages | undefined
): ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
  readonly description?: string
}> {
  const panels = (Array.isArray(rawPanels) ? rawPanels : []) as ReadonlyArray<{
    readonly id?: string
    readonly label?: string
    readonly description?: string
    readonly disabled?: boolean
    readonly body?: string
  }>
  return panels
    .map((panel, index) => {
      const authoredLabel = panel.label ?? ''
      // The id is derived from the AUTHORED label (its translation key, for a
      // `$t:` caption) so it never moves with the active locale.
      const id = panel.id ?? slugifyLabel(idSourceForLabel(authoredLabel))
      const resolvedLabel = localizeChildLabel(authoredLabel, currentLang, languages)
      // A tab with no name is not a tab anyone can use — fall back to the id.
      const label = resolvedLabel.length > 0 ? resolvedLabel : labelFromPanelId(id)
      // The optional second line on the trigger, localized the same way, so a
      // `$t:` reference resolves in a subtitle as it does in a caption. Left
      // `undefined` when absent so an undescribed trigger renders exactly the
      // markup it always did.
      const resolvedDescription =
        panel.description === undefined
          ? undefined
          : localizeChildLabel(panel.description, currentLang, languages)
      // Prefer the panel's own `body` string; otherwise the body is the
      // INDEX-ALIGNED entry of the parent's `children` (PG-04 record-detail
      // composition, a form or data-table embedded inside tabs). The alignment
      // is what `panels.length === children.length` is refused for.
      const childRendered = renderedChildren[index]
      const renderedBody =
        panel.body !== undefined
          ? panel.body
          : childRendered
            ? renderToStaticMarkup(childRendered)
            : ''
      return {
        id,
        label,
        content: renderedBody,
        disabled: panel.disabled,
        description: resolvedDescription,
      }
    })
    .filter((item) => item.id !== '' || item.label !== '' || item.content !== '')
}

/** The one panel a given URL addresses, paired with the markup it renders to. */
export interface AddressedTabPanel {
  readonly id: string
  readonly html: string
}

/**
 * Resolve the panel a given URL ADDRESSES — the one the tabs SSR placeholder
 * renders as real markup.
 *
 * Until this existed the placeholder was pulse skeletons only, and every
 * tab-panel's real content reached the response escaped inside
 * `data-island-props` — where no crawler and no SSR-built search index will ever
 * read it as text. A tabbed hero therefore said nothing at all to a visitor
 * without JavaScript. Rendering the addressed panel's body server-side makes the
 * page's primary message real markup again.
 *
 * ## Why a panel holding an island is NOT excluded
 *
 * It used to be: any content carrying a `data-island` marker fell back to the
 * skeleton, because the island client would discover that nested marker, mount
 * it, and the tabs island would wipe it on its own first render. The exclusion
 * cost far more than it bought — the region the author named and the prose the
 * server composed AROUND the island went with it, so a lens whose body happened
 * to hold a figure silently required JavaScript while its siblings did not
 *.
 *
 * The collision is resolved where it actually lives instead: `mountIslandsWithin`
 * skips a marker that is no longer connected to the document, so the nested
 * island the tabs root just replaced is never mounted onto a detached node. The
 * tabs island then re-injects the same markup and mounts the marker inside its
 * own panel, which is the path `PG-04` has always taken for a form or a grid in
 * a tab.
 *
 * Returns `undefined` — keeping the skeleton — only when there is no body to
 * show at all.
 */
export function resolveAddressedPanel(
  items: ReadonlyArray<{ readonly id: string; readonly content: string }>,
  defaultTab: string | undefined
): AddressedTabPanel | undefined {
  const active = items.find((item) => item.id === defaultTab) ?? items[0]
  if (active === undefined || active.content.length === 0) return undefined
  return { id: active.id, html: active.content }
}

/**
 * The island's `items`, with the ADDRESSED panel's rendered markup removed.
 *
 * That panel is already in the document as markup a reader and a crawler can
 * see; serialising it a second time into `data-island-props` bought the island
 * nothing and cost the response a whole extra copy of the page's largest panel,
 * HTML- and JSON-escaped (`[internal ref]` — measured at 116 629 B of a
 * 266 588 B response on its own fixture, and roughly +66 000 B per address on
 * the operator console's organisation page).
 *
 * The island reads that panel back out of the document instead: the host opts
 * into the pre-mount `ssrHtml` capture in `island-client.tsx`, which runs before
 * `createRoot` discards the server-rendered subtree.
 *
 * ## `lazy`: when EVERY panel's markup is dropped
 *
 * On a tab set the author made an ADDRESS — `defaultTab` bound to a declared
 * `page.query` property — the unaddressed panels are dropped too, and the
 * island asks the server for one when the reader opens it
 *. A reader of one lens then pays for one lens instead
 * of for all of them; on the operator console's five-lens organisation page the
 * props blob was 74 512 B, 49 531 B of it a Map nobody had opened.
 *
 * Otherwise every OTHER panel keeps its `content`, because nothing else on the
 * page carries it — and switching stays instant and offline-safe, which is what
 * a tab set that is not an address should be.
 */
export function stripAddressedPanelContent<T extends { readonly id: string }>(
  items: readonly T[],
  addressedId: string | undefined,
  lazy = false
): ReadonlyArray<T | Omit<T, 'content'>> {
  if (addressedId === undefined && !lazy) return items
  return items.map((item) => {
    if (!lazy && item.id !== addressedId) return item
    const { content: _dropped, ...rest } = item as T & { readonly content?: string }
    return rest
  })
}

export interface TabsSsrItem {
  readonly id: string
  readonly label: string
  readonly description?: string
}

/**
 * A caption in a HORIZONTAL pre-hydration strip — the twin of `TAB_LAYOUT` +
 * `TAB_LAYOUT_FLUSH_HORIZONTAL` in
 * `src/presentation/islands/disclosure/disclosure-default-classes.ts`.
 *
 * Duplicated as a literal for the same reason `computeSsrTabsRootClasses` is:
 * the layer boundary forbids `presentation-component → presentation-island`.
 * The horizontal padding carries the rhythm BETWEEN captions and the
 * `first:pl-0` gives up only the leading edge, so the strip starts where its
 * container starts before hydration as well as after it — and the reader never
 * sees the first caption slide when the island mounts.
 */
const TABS_SSR_TRIGGER_FLUSH = 'text-md px-4 py-2 font-medium first:pl-0'

/**
 * The split layout for the tabs SSR wrapper — the pre-hydration twin of
 * `computeTabsRootClasses` in
 * `src/presentation/islands/disclosure/disclosure-default-classes.ts`.
 *
 * Duplicated as a literal rather than imported because the layer boundary
 * forbids `presentation-component → presentation-island`, and the two strings
 * MUST stay byte-identical: they are applied to the same depth in the same
 * container, one before hydration and one after, and any divergence is a
 * visible repaint the moment the island mounts.
 *
 * A horizontal tab set gets no layout in either state — the strip already sits
 * above the panel in normal block flow — so this returns `undefined` and the
 * wrapper carries nothing but the author's own `className`.
 */
export function computeSsrTabsRootClasses(
  orientation: 'horizontal' | 'vertical'
): string | undefined {
  return orientation === 'vertical'
    ? 'grid grid-cols-1 gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start'
    : undefined
}

/**
 * Trigger strip for the tabs SSR placeholder.
 *
 * Mirrors the hydrated island's LAYOUT so the page does not jump when the
 * island mounts: a vertical tab set stacks its trigger rail above the panel on
 * a phone and moves it beside the panel from `md` up, exactly as the recipe
 * does, and a described trigger already shows both of its lines.
 *
 * Labels are real text, not skeleton bars — they are the band of the page a
 * crawler reads first. They are plain `<span>`s and NOT `role="tab"`, so
 * `getByRole('tab', …)` only ever resolves to the hydrated island's triggers
 * and never transiently matches two elements during the mount window. The
 * description spans deliberately carry no `id`: `aria-describedby` wiring is
 * the hydrated trigger's job, and a duplicate id during the mount window would
 * make the association ambiguous.
 *
 * ## `lazyParam`: the captions become real links
 *
 * On a tab set the author made an ADDRESS, the unopened panels are not in the
 * response at all, so a reader without scripting has no
 * way back to them unless the caption IS a link. With `lazyParam` each caption
 * is an `<a href="?<param>=<id>">` — the same address the island fetches, so
 * the no-JS path and the enhanced path agree by construction, and a crawler
 * reaches every lens instead of only the default one.
 *
 * An `<a>` has `role="link"`, not `role="tab"`, so the mount-window ambiguity
 * the plain spans avoid is avoided here for the same reason. The href is
 * deliberately query-only and therefore REPLACES the document's query string:
 * with scripting on, the island keeps the page's other parameters (it edits one
 * key of the live URL); without it, a second declared parameter would be lost
 * on a lens switch. No shipped tab set declares one, and preserving them here
 * would mean plumbing the resolved request query down to a class-list helper.
 */
export function renderTabsSsrTriggerStrip(
  items: readonly TabsSsrItem[],
  orientation: 'horizontal' | 'vertical',
  lazyParam?: string
): ReactElement {
  const triggerClass =
    orientation === 'vertical' ? 'text-md px-1 py-2 font-medium' : TABS_SSR_TRIGGER_FLUSH
  const triggers =
    items.length > 0 ? (
      items.map((item) => {
        const caption =
          item.description !== undefined && item.description.length > 0 ? (
            <>
              <span className="block">{item.label}</span>
              <span className="text-foreground-muted mt-0.5 block text-sm font-normal">
                {item.description}
              </span>
            </>
          ) : (
            item.label
          )
        return lazyParam === undefined ? (
          <span
            key={item.id}
            className={triggerClass}
          >
            {caption}
          </span>
        ) : (
          <a
            key={item.id}
            href={`?${lazyParam}=${encodeURIComponent(item.id)}`}
            className={triggerClass}
          >
            {caption}
          </a>
        )
      })
    ) : (
      <>
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
        <div className="bg-background-subtle h-8 w-20 animate-pulse rounded" />
      </>
    )

  if (orientation === 'vertical') {
    // No width here: the rail's width is the wrapper's FIRST grid track, exactly
    // as `computeTabsListClasses({ orientation: 'vertical' })` leaves it to
    // `computeTabsRootClasses`. A `md:w-72` in this one place would survive an
    // author who re-proportioned the track and would move the rail's edge on
    // hydration.
    return (
      <div className="border-border flex flex-col gap-1 border-b px-4 py-2 md:border-r md:border-b-0">
        {triggers}
      </div>
    )
  }
  return (
    <div className="border-border border-b">
      {/*
        No `px-4` on the strip and no `gap-4` between the captions: the spacing
        lives on the triggers, exactly as it does in the hydrated island, so the
        leading caption starts at the container edge and
        the rest of the row keeps its rhythm. With the gutter here instead, the
        pre-hydration strip painted its first caption 20px in and the hydrated
        one painted it at 0 — a visible slide on mount.
      */}
      <div className="flex">{triggers}</div>
    </div>
  )
}

/**
 * Map a tabs component's `children` array to the `items` shape consumed by
 * TabsIsland. Each child is expected to be a `tab-panel` with either:
 *  - `props.id` + `content.{label, body}` (canonical legacy form), OR
 *  - `props.label` (PG-04 record-detail composition form) — the label
 *    doubles as the tab's accessible name; `id` is derived from a slug of
 *    the label so the Base UI Tabs primitive still has a stable value to
 *    correlate triggers and panels.
 *
 * PG-04: when a tab-panel
 * declares its content as child React components (form, data-table) rather
 * than the legacy `content.body` string, the pre-rendered SSR HTML for those
 * children is passed in via `renderedChildren[index]`. The index-aligned
 * pre-rendered React element is converted to a static HTML string via
 * `renderToStaticMarkup` and injected into the panel via the island's
 * `dangerouslySetInnerHTML` so the embedded form/data-table SSR skeleton is
 * visible inside the active tab. Any client-side island markers inside (e.g.
 * `data-island="crud-form"`) need separate post-hydration mounting — see
 * tabs-island.tsx mount-effect.
 *
 * Children that resolve to an empty id AND empty label AND no content are
 * skipped so the island only renders well-formed tabs.
 */
/**
 * Derive a human tab label from a panel `id` (`'automations'` → `'Automations'`,
 * `'open-invoices'` → `'Open Invoices'`).
 *
 * Used only when a panel declares neither `content.label` nor `props.label` — the
 * third authoring shape, where the panel's whole body is child components and the
 * author never wrote a caption. That shape previously produced a tab trigger with
 * NO accessible name at all: unusable for a screen reader, unaddressable by
 * `getByRole('tab', { name })`, and indistinguishable from its siblings. The `id`
 * is the only naming information such a panel carries, so it becomes the name.
 * This is the inverse of the `label → id` slug fallback just below.
 */
function labelFromPanelId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
