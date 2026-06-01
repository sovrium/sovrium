/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { DROPDOWN_TRIGGER_CLASS, useDropdownState } from './use-dropdown-state'


export interface ViewsMenuEntry {
  readonly id: string
  readonly name: string
  readonly source: 'developer' | 'personal'
}

interface ViewsMenuProps {
  readonly views: ReadonlyArray<ViewsMenuEntry>
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onSaveCurrentView: () => void
  readonly onDeleteView: (entry: ViewsMenuEntry) => void
}

export function ViewsMenu({
  views,
  onSelectView,
  onSaveCurrentView,
  onDeleteView,
}: ViewsMenuProps) {
  const { open, rootRef, onToggle, close } = useDropdownState({ closeOnEscape: true })
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
      className="border-border bg-background-overlay absolute right-0 z-50 mt-1 min-w-[14rem] rounded border py-1 shadow-lg"
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
        className="border-border my-1 border-t"
      />
      <button
        type="button"
        role="menuitem"
        onClick={onSaveCurrent}
        className="hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm"
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
      <div className="group hover:bg-background-subtle flex items-center">
        <button
          type="button"
          role="menuitem"
          onClick={handleSelect}
          className="flex-1 px-4 py-2 text-left text-sm"
        >
          {entry.name}
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={handleShare}
          className="text-foreground-muted hover:text-primary invisible mr-1 px-2 py-1 text-xs group-hover:visible"
        >
          Share
        </button>
        {entry.source === 'personal' && (
          <button
            type="button"
            aria-label="Delete view"
            onClick={handleDelete}
            className="text-foreground-muted hover:text-error-fg invisible mr-2 px-2 py-1 text-xs group-hover:visible"
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

function ShareLinkPopover({ entry }: ShareLinkPopoverProps) {
  const shareUrl = buildShareUrl(entry.id)
  return (
    <div className="border-border bg-background mx-3 my-2 rounded border p-2">
      <label className="text-foreground-muted mb-1 block text-xs">Share link</label>
      <input
        type="text"
        readOnly
        aria-label="Share link"
        value={shareUrl}
        onFocus={selectAllOnFocus}
        className="border-border w-full rounded border bg-transparent px-2 py-1 text-xs"
      />
    </div>
  )
}

function buildShareUrl(viewId: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set('userView', viewId)
  return url.toString()
}

function selectAllOnFocus(event: React.FocusEvent<HTMLInputElement>) {
  event.currentTarget.select()
}
