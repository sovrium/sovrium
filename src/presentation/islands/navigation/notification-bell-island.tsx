/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { computeSidebarEntryBadgeClasses } from '@/presentation/design/sidebar-menu-default-classes'
import { computePopoverContentClasses } from '../overlays/popover-default-classes'
import { useNotificationFeed, type BellNotification } from './use-notification-feed'
import type { KeyboardEvent, ReactElement } from 'react'

/**
 * `notification-bell` — the signed-in reader's own notifications.
 *
 * The trigger carries her unread count; the popover lists her latest ones,
 * newest first. Opening it marks nothing. Clicking an item marks THAT item
 * read, then opens the address `sourceHrefs` gives its table; "Mark all read"
 * clears the rest. The server draws this island only for a signed-in reader,
 * and every read is of the session's own rows.
 */
interface NotificationBellIslandProps {
  readonly label?: string
  readonly emptyLabel?: string
  readonly markAllLabel?: string
  readonly limit?: number
  /** Table name → address with `{recordId}` to fill. */
  readonly sourceHrefs?: Readonly<Record<string, string>>
}

/** lucide's `bell`. */
const BELL_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
)

/** The address a notification opens on this site, or none when its table is not mapped. */
function hrefOf(
  notification: BellNotification,
  sourceHrefs: Readonly<Record<string, string>> | undefined
): string | undefined {
  const { source } = notification
  // Own keys only: a table named `constructor` must not read the object's prototype.
  if (source === null || sourceHrefs === undefined || !Object.hasOwn(sourceHrefs, source.table)) {
    return undefined
  }
  const template = sourceHrefs[source.table]
  if (typeof template !== 'string') return undefined
  return toSafeRedirectPath(template.replaceAll('{recordId}', encodeURIComponent(source.recordId)))
}

/** One listed notification: a link to its source when it has one, else a button. */
function BellItem({
  notification,
  href,
  onOpen,
}: {
  readonly notification: BellNotification
  readonly href: string | undefined
  readonly onOpen: (notification: BellNotification, href: string | undefined) => void
}): ReactElement {
  const className = `block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent ${notification.read ? 'text-muted-foreground' : 'font-medium'}`
  const open = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    onOpen(notification, href)
  }
  return (
    <li data-read={notification.read ? 'true' : 'false'}>
      {href === undefined ? (
        <button
          type="button"
          className={className}
          onClick={open}
        >
          {notification.title}
        </button>
      ) : (
        <a
          href={href}
          className={className}
          onClick={open}
        >
          {notification.title}
        </a>
      )}
    </li>
  )
}

/** The bell's open state: a click outside closes it, and Escape hands focus back to the trigger. */
function useBellPopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    setOpen(false)
    trigger.current?.focus()
  }, [])
  const toggle = useCallback(() => setOpen((previous) => !previous), [])
  return { open, setOpen, root, trigger, onKeyDown, toggle }
}

/** The open popover: her latest notifications, or the empty line, and "Mark all read". */
function BellPanel({
  label,
  emptyLabel,
  markAllLabel,
  sourceHrefs,
  feed,
  onOpen,
}: Required<Pick<NotificationBellIslandProps, 'label' | 'emptyLabel' | 'markAllLabel'>> &
  Pick<NotificationBellIslandProps, 'sourceHrefs'> & {
    readonly feed: ReturnType<typeof useNotificationFeed>
    readonly onOpen: (notification: BellNotification, href: string | undefined) => void
  }): ReactElement {
  return (
    <div
      role="dialog"
      aria-label={label}
      data-slot="popover-content"
      className={`${computePopoverContentClasses()} absolute right-0 z-50 mt-2 w-80`}
    >
      {feed.notifications.length === 0 ? (
        <p className="text-muted-foreground px-2 py-1.5 text-sm">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {feed.notifications.map((notification) => (
            <BellItem
              key={notification.id}
              notification={notification}
              href={hrefOf(notification, sourceHrefs)}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
      {feed.unreadCount > 0 && (
        <button
          type="button"
          onClick={feed.markAllRead}
          className="text-primary mt-2 w-full rounded-sm px-2 py-1.5 text-left text-sm hover:underline"
        >
          {markAllLabel}
        </button>
      )}
    </div>
  )
}

export default function NotificationBellIsland({
  label = 'Notifications',
  emptyLabel = 'No notifications',
  markAllLabel = 'Mark all read',
  limit = 20,
  sourceHrefs,
}: NotificationBellIslandProps): ReactElement {
  const feed = useNotificationFeed(limit)
  const popover = useBellPopover()
  const { setOpen } = popover
  const { markRead } = feed

  // Mark it read first, so the page it opens already counts it read.
  const openItem = useCallback(
    (notification: BellNotification, href: string | undefined) => {
      void markRead(notification.id).then(() => {
        const target = toSafeRedirectPath(href)
        if (target === undefined) return setOpen(false)
        window.location.assign(target)
      })
    },
    [markRead, setOpen]
  )

  return (
    <div
      ref={popover.root}
      className="relative inline-block"
      onKeyDown={popover.onKeyDown}
    >
      <button
        ref={popover.trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={popover.open ? 'true' : 'false'}
        onClick={popover.toggle}
        className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md p-2"
      >
        {BELL_GLYPH}
        <span className="sr-only">{label}</span>
        {feed.unreadCount > 0 && (
          <span className={computeSidebarEntryBadgeClasses()}>{feed.unreadCount}</span>
        )}
      </button>
      {popover.open && (
        <BellPanel
          label={label}
          emptyLabel={emptyLabel}
          markAllLabel={markAllLabel}
          sourceHrefs={sourceHrefs}
          feed={feed}
          onOpen={openItem}
        />
      )}
    </div>
  )
}
