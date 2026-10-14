/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  computeAvatarBadgeClasses,
  computeAvatarBoxClasses,
  computeAvatarFallbackClasses,
  computeAvatarGroupClasses,
  computeAvatarImageClasses,
} from '@/presentation/design/display-default-classes'

/**
 * One presence entry as delivered by the `/api/realtime/presence` SSE stream.
 *
 * Mirrors the server-side `realtimePresenceEntrySchema`
 * (`src/domain/models/api/realtime/realtime.ts`).
 */
interface PresenceUser {
  readonly id: string
  readonly name: string
  readonly avatarUrl?: string
  readonly pagePath: string
  readonly joinedAt: string
}

interface PresenceIndicatorIslandProps {
  /** Page path this presence indicator is scoped to. */
  readonly pagePath?: string
  readonly 'data-testid'?: string
}

/**
 * Reduce a SSE presence message into the underlying connection-keyed entry
 * list ([internal ref]-035a).
 *
 * The server tracks presence per connection (one entry per browser tab) — the
 * connection key is load-bearing for stale-cleanup and the
 * 50-entry per-page cap. When a user opens the same page
 * in two tabs, the server snapshot legitimately contains two entries with the
 * same `user.id` but distinct `joinedAt` timestamps. We preserve the
 * connection-keyed shape inside this reducer; the rendering layer deduplicates
 * by `user.id` so the indicator surfaces one avatar per user.
 *
 * - `presence-sync`: replace the whole list with the server snapshot (one
 *   entry per connection — the renderer dedupes).
 * - `join`: append the joining connection's entry. Multiple connections for
 *   the same user are tracked as distinct list elements (keyed by `joinedAt`).
 * - `leave`: drop ONE entry matching the leaving `userId` — the oldest by
 *   `joinedAt` (FIFO with the connection that just closed). If the user has
 *   another live connection on this page, the renderer keeps showing them.
 * Any other message type (`heartbeat`) leaves the list unchanged.
 */
function applyPresenceMessage(
  current: readonly PresenceUser[],
  message: {
    readonly type?: string
    readonly users?: readonly PresenceUser[]
    readonly user?: PresenceUser
    readonly userId?: string
  }
): readonly PresenceUser[] {
  if (message.type === 'presence-sync' && Array.isArray(message.users)) {
    return message.users
  }
  if (message.type === 'join' && message.user) {
    const { user } = message
    return [...current, user]
  }
  if (message.type === 'leave' && typeof message.userId === 'string') {
    const { userId } = message
    const oldestIndex = current.findIndex((u) => u.id === userId)
    if (oldestIndex === -1) return current
    return [...current.slice(0, oldestIndex), ...current.slice(oldestIndex + 1)]
  }
  return current
}

/**
 * Deduplicate a connection-keyed presence list to one entry per `user.id`.
 *
 * When the same user holds multiple connections (e.g. two browser tabs), only
 * the most recently-joined entry is surfaced as an avatar ([internal ref]-035a).
 */
function uniqueByUserId(entries: readonly PresenceUser[]): readonly PresenceUser[] {
  // Build a one-entry-per-user map by feeding the list to `new Map(...)` in
  // ascending `joinedAt` order — later assignments to the same key win, so
  // the most recent connection for each user is the one preserved.
  const sorted = entries.toSorted((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  const byId = new Map<string, PresenceUser>(sorted.map((entry) => [entry.id, entry]))
  return [...byId.values()]
}

/** Two-letter avatar initials derived from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase()
  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase()
}

const AVATAR_CLASSES = computeAvatarBoxClasses({ size: 'sm', shape: 'circle' })
const AVATAR_IMAGE_CLASSES = computeAvatarImageClasses({ shape: 'circle' })
const AVATAR_FALLBACK_CLASSES = computeAvatarFallbackClasses({ shape: 'circle' })
const AVATAR_BADGE_CLASSES = computeAvatarBadgeClasses()
const AVATAR_GROUP_CLASSES = computeAvatarGroupClasses()

/**
 * One viewer, as shadcn/ui's small Avatar: her photo or her initials, with the
 * badge saying she is here now, and her name on hover.
 */
function PresenceAvatar({ user }: { readonly user: PresenceUser }): ReactElement {
  return (
    <span
      data-slot="avatar"
      data-size="sm"
      data-presence-user-id={user.id}
      title={user.name}
      className={AVATAR_CLASSES}
    >
      {user.avatarUrl ? (
        <img
          data-slot="avatar-image"
          src={user.avatarUrl}
          alt={user.name}
          width={24}
          height={24}
          className={AVATAR_IMAGE_CLASSES}
        />
      ) : (
        <span
          aria-hidden="true"
          data-slot="avatar-fallback"
          className={AVATAR_FALLBACK_CLASSES}
        >
          {initials(user.name)}
        </span>
      )}
      <span
        aria-hidden="true"
        data-slot="avatar-badge"
        className={AVATAR_BADGE_CLASSES}
      />
    </span>
  )
}

/**
 * The viewers' names, written beside the group so a reader (and assistive
 * technology) reads who is here, not only their initials.
 */
function PresenceNames({ users }: { readonly users: readonly PresenceUser[] }): ReactElement {
  return (
    <span className="text-muted-foreground text-sm">
      {users.map((user, index) => (
        <span key={user.id}>
          {index > 0 && ', '}
          <span data-presence-name="">{user.name}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * The viewers of `pagePath`, one per person: an `EventSource` on
 * `/api/realtime/presence?pagePath=...` reconciles `presence-sync` / `join` /
 * `leave` events into a connection-keyed list — one element per server-side
 * connection, so closing one of a user's tabs removes only that tab's entry —
 * returned deduplicated by user id ([internal ref]-035a).
 */
function usePresenceUsers(pagePath: string | undefined): readonly PresenceUser[] {
  const [entries, setEntries] = useState<readonly PresenceUser[]>([])
  useEffect(() => {
    if (
      pagePath === undefined ||
      typeof window === 'undefined' ||
      typeof EventSource === 'undefined'
    ) {
      return undefined
    }
    const source = new EventSource(
      `/api/realtime/presence?pagePath=${encodeURIComponent(pagePath)}`
    )
    const handleMessage = (event: MessageEvent): void => {
      try {
        const parsed = JSON.parse(event.data) as Parameters<typeof applyPresenceMessage>[1]
        setEntries((current) => applyPresenceMessage(current, parsed))
      } catch {
        // Malformed frame — ignore; the next valid event reconciles.
      }
    }
    source.addEventListener('message', handleMessage)
    return () => {
      source.removeEventListener('message', handleMessage)
      source.close()
    }
  }, [pagePath])
  return useMemo(() => uniqueByUserId(entries), [entries])
}

/**
 * Presence-indicator island — who else is on this page, as shadcn/ui's avatar
 * group with the viewers' names beside it.
 *
 * The island is rendered on every page configured with `presence: true`
 * (the SSR placeholder is injected by `DynamicPage`).
 */
export default function PresenceIndicatorIsland({
  pagePath,
  'data-testid': testId = 'presence-indicator',
}: PresenceIndicatorIslandProps): ReactElement {
  const visibleUsers = usePresenceUsers(pagePath)
  return (
    <div
      data-testid={testId}
      data-slot="presence-indicator"
      data-presence-count={visibleUsers.length}
      aria-label="Users viewing this page"
      className="flex items-center gap-2"
    >
      <div
        data-slot="avatar-group"
        className={AVATAR_GROUP_CLASSES}
      >
        {visibleUsers.map((user) => (
          <PresenceAvatar
            key={user.id}
            user={user}
          />
        ))}
      </div>
      <PresenceNames users={visibleUsers} />
    </div>
  )
}
