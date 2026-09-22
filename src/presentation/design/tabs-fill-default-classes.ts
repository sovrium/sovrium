/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The classes a tab set takes on under `tabs.layout: 'fill'` — the link that
 * carries a bounded parent's height down to the active panel, so a `table`
 * declaring `layout: 'fill'` inside that panel owns its own scroll.
 *
 * ## Why this lives in `design/` and not beside the tabs recipe
 *
 * A tab set is drawn TWICE. The server draws it in
 * `render/registry/island-form-components.tsx` and
 * `render/registry/island-tabs-ssr.tsx` (a `presentation-component`); the
 * browser redraws it in `islands/disclosure/tabs-island.tsx`. The layer
 * boundary forbids BOTH directions across that seam, which is why
 * `computeSsrTabsRootClasses` carries a HAND-COPY of the vertical grid string
 * under a comment saying the two must stay byte-identical.
 *
 * `presentation/design` is the one tree both sides may import — the
 * `sidebar-default-classes.ts` precedent, which ended exactly that duplication
 * for the sidebar. The fill vocabulary starts here rather than being copied
 * twice and then drifting: the two halves are applied at the same depth in the
 * same container, one before hydration and one after, and any divergence is a
 * visible repaint the moment the island mounts.
 *
 * ## The four declarations, and why none of them can be dropped
 *
 * `flex min-h-0 flex-1 flex-col` is `TABLE_FILL_SHELL` verbatim
 * (`table-shell-default-classes.ts`), and it is one idea rather than four:
 * growing into the parent's leftover height WITHOUT the floor lets the flex
 * algorithm size the box to its content instead, so the element reports the
 * very height it was asked to stop having; becoming a column in turn is what
 * lets the part below claim that leftover.
 *
 * ## Why the panel also dresses its DIRECT children
 *
 * A panel's grid is rarely its own child — the operator console's run history
 * wraps its table in a container for padding, and that is the shape the spec
 * fixture reproduces. That intermediate box is a link in the chain the author
 * never wrote and cannot reach: it is emitted by the panel's own content, so no
 * `className` on the `tabs` node addresses it. A block box there takes its
 * natural height and hands the bound to nobody, and the grid inside it is left
 * at exactly the height it would have had if the tab set had declared nothing.
 *
 * `[&>*]` is therefore ONE level deep, deliberately, and not a descendant
 * sweep: it re-opens the chain across the wrapper a panel's content brings with
 * it, and stops. Anything nested deeper is the author's own composition and is
 * dressed the way every other link in a fill chain is — `fillHost` in the
 * console's own `dataPage.ts` is that shape written out.
 *
 * ## The default adds nothing
 *
 * `flow` — the default — returns the empty string, so a tab set that declares
 * no layout renders byte-identical markup to the one it rendered before this
 * key existed.
 */

/** How a tab set occupies the space its parent gives it. */
export type TabsLayout = 'flow' | 'fill'

/** The bounded-column part, shared with the grid's own `TABLE_FILL_SHELL`. */
const TABS_FILL_SHELL = 'flex min-h-0 flex-1 flex-col'

/**
 * A VERTICAL root keeps its two-track grid — replacing it with a flex column
 * would put the trigger rail back above the panel and undo `[internal ref]`
 * — so it claims the leftover height without touching `display`, and pins the
 * panel's track so the bound reaches it: one filling row beside the rail from
 * `md` up, rail-then-filling-panel while they are stacked.
 */
const TABS_FILL_ROOT_VERTICAL =
  'min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]'

/** The active panel: a bounded column that re-opens the chain across one wrapper. */
const TABS_FILL_PANEL = `${TABS_FILL_SHELL} [&>*]:flex [&>*]:min-h-0 [&>*]:flex-1 [&>*]:flex-col`

/**
 * Compute the extra className the tab set's own boxes take on under
 * `layout: 'fill'` — the island mount host, and the root the island renders
 * inside it.
 */
export const computeTabsFillShellClasses = (
  layout: TabsLayout | undefined,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): string =>
  layout !== 'fill' ? '' : orientation === 'vertical' ? TABS_FILL_ROOT_VERTICAL : TABS_FILL_SHELL

/**
 * Compute the extra className the ACTIVE panel takes on under `layout: 'fill'`.
 *
 * Only the active one: Base UI renders a tab panel at all only while it is
 * selected (`keepMounted` defaults to `false`), so the class list reaches
 * exactly the panel a reader is looking at and no other.
 */
export const computeTabsFillPanelClasses = (layout: TabsLayout | undefined): string =>
  layout === 'fill' ? TABS_FILL_PANEL : ''
