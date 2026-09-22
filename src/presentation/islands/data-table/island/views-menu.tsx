/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import {
  computeTableMenuClasses,
  computeTableMenuItemClasses,
  computeTableMenuSeparatorClasses,
} from '@/presentation/design/table-default-classes'
import { DROPDOWN_TRIGGER_CLASS, useDropdownState } from './use-dropdown-state'

/**
 * Views dropdown rendered in the data-table toolbar (PG-03 /
 * [internal ref]).
 *
 * Surfaces three kinds of `menuitem` entries:
 *
 *  1. **Developer views** — declared in the table schema via
 *     `app.tables[i].views[]`. Read-only: the menu provides no delete
 *     affordance for them (the spec asserts that personal `Save` is hidden
 *     and only `Save as new` is offered for these). Marked with
 *     `data-view-source="developer"` for downstream affordance hooks.
 *
 *  2. **Personal saved views** — created via the Save view dialog. Each entry
 *     reveals a `<button>Delete view</button>` on hover (rendered as a
 *     sibling inside the same `<li>`); clicking it opens the confirmation
 *     dialog the caller mounts. Marked with `data-view-source="personal"`.
 *
 *  3. A trailing `Save current view` menuitem (always last) — short-cut into
 *     the Save dialog the toolbar's `Save view` button also opens. Spec
 * [internal ref] explicitly asserts this exists even when the user
 *     has zero personal views.
 *
 * **Cycle 6:** every row additionally reveals a
 * `<button>Share</button>` on hover. Clicking it shows an inline read-only
 * `<input>` whose value is the full URL augmented with `?userView=<id>`. The
 * input is the textbox the spec asserts via `getByRole('textbox', { name:
 * /share link|url/i })`. The popover persists inside the menu until the
 * outside-click handler closes it (matching the Delete affordance lifecycle).
 *
 * Plain-`<div>` dropdown (NOT a Base UI Menu) for the same reason
 * `group-menu.tsx` is: the user immediately clicks ANOTHER UI element right
 * after selecting a view (a `<tr>` row, a `<th>` columnheader, etc.), and
 * Base UI Menu's anchored Portal lingers briefly with `inert=true` after
 * close, which makes Playwright's actionability check time out.
 *
 * Outside-click closes the menu (matching the `mousedown` timing of the
 * sibling group/density menus); selection AND the trailing `Save current
 * view` action also close it.
 */

/** Combined developer-OR-personal view row surfaced in the menu. */
export interface ViewsMenuEntry {
  readonly id: string
  readonly name: string
  readonly source: 'developer' | 'personal'
}

interface ViewsMenuProps {
  readonly views: ReadonlyArray<ViewsMenuEntry>
  /**
   * Fired when the user clicks a `menuitem` for a developer or personal view.
   * The caller resolves the view's config and applies it to the data-table.
   */
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  /**
   * Fired when the user clicks the trailing `Save current view` menuitem.
   * Wired by the toolbar to the same handler as the Save view button.
   */
  readonly onSaveCurrentView: () => void
  /**
   * Fired when the user clicks the `Delete view` button revealed on hover
   * over a personal view's row. Caller opens the confirmation dialog.
   */
  readonly onDeleteView: (entry: ViewsMenuEntry) => void
}

// eslint-disable-next-line max-lines-per-function -- composes the dropdown root + 4 stable callbacks; further extraction would just split a single concern across more files
export function ViewsMenu({
  views,
  onSelectView,
  onSaveCurrentView,
  onDeleteView,
}: ViewsMenuProps) {
  // Outside-click + Escape close handled by the shared hook. `mousedown`
  // semantics mirror group-menu so a follow-up `click` on another DOM element
  // fires AFTER the menu closes.
  const { open, rootRef, onToggle, close } = useDropdownState({ closeOnEscape: true })
  // Cycle 6: the share popover is per-row state inside the menu — at most one
  // row at a time has its share input visible. Tracking via the entry's
  // `${source}:${id}` key (`null` = no popover) keeps the state shape
  // identical to the menu's `key=` prop so React's reconciliation lines up.
  // eslint-disable-next-line unicorn/no-null -- `null` is the explicit "no popover open" signal; the alternative `undefined` would collide with React.useState's no-initial-value form
  const [shareTarget, setShareTarget] = useState<string | null>(null)

  const handleSelect = useCallback(
    (entry: ViewsMenuEntry) => {
      onSelectView(entry)
      close()
    },
    [onSelectView, close]
  )
  const handleSaveCurrent = useCallback(() => {
    onSaveCurrentView()
    close()
  }, [onSaveCurrentView, close])
  const handleDelete = useCallback(
    (entry: ViewsMenuEntry) => {
      onDeleteView(entry)
      close()
    },
    [onDeleteView, close]
  )
  const handleShare = useCallback((entry: ViewsMenuEntry) => {
    setShareTarget(`${entry.source}:${entry.id}`)
  }, [])

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        aria-label="Views"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={DROPDOWN_TRIGGER_CLASS}
      >
        Views
      </button>
      {open && (
        <ViewsMenuPopup
          views={views}
          shareTarget={shareTarget}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onShare={handleShare}
          onSaveCurrent={handleSaveCurrent}
        />
      )}
    </div>
  )
}

interface ViewsMenuPopupProps {
  readonly views: ReadonlyArray<ViewsMenuEntry>
  readonly shareTarget: string | null
  readonly onSelect: (entry: ViewsMenuEntry) => void
  readonly onDelete: (entry: ViewsMenuEntry) => void
  readonly onShare: (entry: ViewsMenuEntry) => void
  readonly onSaveCurrent: () => void
}

/**
 * The dropdown body of {@link ViewsMenu}: the list of `menuitem` rows + a
 * trailing `Save current view` item.
 *
 * Extracted so the parent's render body stays under the islands' 60-line
 * max-lines-per-function cap. Conditionally mounted via `open && <… />` —
 * `useDropdownState` close-on-select fires before the popup re-renders, so
 * the lifecycle is bounded.
 */
function ViewsMenuPopup({
  views,
  shareTarget,
  onSelect,
  onDelete,
  onShare,
  onSaveCurrent,
}: ViewsMenuPopupProps) {
  return (
    <div
      role="menu"
      aria-label="Views"
      // `min-w-48` (192px) for the arbitrary `min-w-[14rem]` it replaces: the
      // same order of width, spent as a ladder step rather than a literal.
      className={`${computeTableMenuClasses()} absolute right-0 mt-1 min-w-48`}
    >
      {views.map((entry) => (
        <ViewsMenuItem
          key={`${entry.source}:${entry.id}`}
          entry={entry}
          shareOpen={shareTarget === `${entry.source}:${entry.id}`}
          onSelect={onSelect}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}
      <div
        role="separator"
        className={computeTableMenuSeparatorClasses()}
      />
      <button
        type="button"
        role="menuitem"
        onClick={onSaveCurrent}
        className={computeTableMenuItemClasses()}
      >
        Save current view
      </button>
    </div>
  )
}

interface ViewsMenuItemProps {
  readonly entry: ViewsMenuEntry
  readonly shareOpen: boolean
  readonly onSelect: (entry: ViewsMenuEntry) => void
  readonly onDelete: (entry: ViewsMenuEntry) => void
  readonly onShare: (entry: ViewsMenuEntry) => void
}

/**
 * A single row in the Views menu. Personal rows reveal a `Delete view` button
 * on `group-hover:`; developer rows omit the delete affordance entirely.
 *
 * The delete + share buttons use `stopPropagation` because the row itself is
 * a `menuitem` button — without stopping the event, clicking Delete/Share
 * would also fire `onSelect` for the row, which would simultaneously apply
 * the view AND delete/share it.
 *
 * Cycle 6: every row gets a Share affordance. When `shareOpen` is true, the
 * inline read-only `<input>` is rendered below the row carrying the full URL
 * with `?userView=<id>` appended — the textbox the spec queries via
 * `getByRole('textbox', { name: /share link|url/i })`.
 */
function ViewsMenuItem({ entry, shareOpen, onSelect, onDelete, onShare }: ViewsMenuItemProps) {
  const handleSelect = useCallback(() => onSelect(entry), [entry, onSelect])
  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onDelete(entry)
    },
    [entry, onDelete]
  )
  const handleShare = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onShare(entry)
    },
    [entry, onShare]
  )
  return (
    <div data-view-source={entry.source}>
      <div className={`${computeTableMenuItemClasses()} group flex items-center`}>
        <button
          type="button"
          role="menuitem"
          onClick={handleSelect}
          // The ROW carries the item chrome and the hover well, so the button
          // inside it contributes only its flex share — otherwise a hovered row
          // painted one well and the button inside it a second, offset one.
          className="flex-1 text-left"
        >
          {entry.name}
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={handleShare}
          className="text-foreground-muted hover:text-primary invisible mr-1 px-2 py-1 text-sm group-hover:visible"
        >
          Share
        </button>
        {entry.source === 'personal' && (
          <button
            type="button"
            aria-label="Delete view"
            onClick={handleDelete}
            className="text-foreground-muted hover:text-error-fg invisible mr-2 px-2 py-1 text-sm group-hover:visible"
          >
            Delete view
          </button>
        )}
      </div>
      {shareOpen && <ShareLinkPopover entry={entry} />}
    </div>
  )
}

interface ShareLinkPopoverProps {
  readonly entry: ViewsMenuEntry
}

/**
 * Inline share-link popover surfaced under a Views-menu row when the user
 * clicks `Share`.
 *
 * Computes the share URL from `window.location` and appends `userView=<id>`.
 * Renders as a read-only `<input>` (the spec's `getByRole('textbox', { name:
 * /share link|url/i })`) so the URL is selectable for copy. SSR-safe: when
 * `window` is absent we render an empty input — hydration on the client
 * patches it up to the real URL.
 */
function ShareLinkPopover({ entry }: ShareLinkPopoverProps) {
  const shareUrl = buildShareUrl(entry.id)
  return (
    <div className="border-border bg-background mx-3 my-2 rounded border p-2">
      <label className="text-foreground-muted mb-1 block text-sm">Share link</label>
      <input
        type="text"
        readOnly
        aria-label="Share link"
        value={shareUrl}
        onFocus={selectAllOnFocus}
        className="border-border w-full rounded border bg-transparent px-2 py-1 text-sm"
      />
    </div>
  )
}

/**
 * Build the share URL containing `?userView=<id>` for the current page.
 *
 * Uses `window.location` so the URL reflects the page the user is viewing
 * (not just the bound table). Preserves any existing query params apart from
 * `userView` (replaced) so reloading the share URL re-applies the same view.
 *
 * Server-side rendering falls back to an empty string — the share popover is
 * only opened by user interaction in the browser, so this branch is
 * unreachable in practice but keeps the function pure for unit tests.
 */
function buildShareUrl(viewId: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  // Replace any existing `userView` param so re-sharing from a shared-link
  // page doesn't accumulate stale view IDs.
  url.searchParams.set('userView', viewId)
  return url.toString()
}

/** Select the input contents on focus so the user can immediately copy. */
function selectAllOnFocus(event: React.FocusEvent<HTMLInputElement>) {
  event.currentTarget.select()
}
