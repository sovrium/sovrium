/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react'

interface PresenceUser {
  readonly id: string
  readonly name: string
  readonly avatarUrl?: string
  readonly pagePath: string
  readonly joinedAt: string
}

interface PresenceIndicatorIslandProps {
  readonly pagePath?: string
  readonly 'data-testid'?: string
}

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

function uniqueByUserId(entries: readonly PresenceUser[]): readonly PresenceUser[] {
  const sorted = entries.toSorted((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  const byId = new Map<string, PresenceUser>(sorted.map((entry) => [entry.id, entry]))
  return [...byId.values()]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase()
  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase()
}

function PresenceChip({ user }: { readonly user: PresenceUser }): ReactElement {
  return (
    <span
      data-presence-user-id={user.id}
      title={user.name}
      className="border-border bg-background-raised text-foreground inline-flex items-center gap-2 rounded-full border py-0.5 pr-3 pl-0.5 text-sm"
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          width={28}
          height={28}
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
        >
          {initials(user.name)}
        </span>
      )}
      <span className="font-medium">{user.name}</span>
    </span>
  )
}

export default function PresenceIndicatorIsland({
  pagePath,
  'data-testid': testId = 'presence-indicator',
}: PresenceIndicatorIslandProps): ReactElement {
  const [entries, setEntries] = useState<readonly PresenceUser[]>([])
  const visibleUsers = useMemo(() => uniqueByUserId(entries), [entries])

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
      }
    }

    source.addEventListener('message', handleMessage)

    return () => {
      source.removeEventListener('message', handleMessage)
      source.close()
    }
  }, [pagePath])

  return (
    <div
      data-testid={testId}
      data-presence-count={visibleUsers.length}
      aria-label="Users viewing this page"
      className="flex flex-wrap items-center gap-2"
    >
      {visibleUsers.map((user) => (
        <PresenceChip
          key={user.id}
          user={user}
        />
      ))}
    </div>
  )
}
