/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'

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
    return [...current.filter((u) => u.id !== user.id), user]
  }
  if (message.type === 'leave' && typeof message.userId === 'string') {
    const { userId } = message
    return current.filter((u) => u.id !== userId)
  }
  return current
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
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          width={28}
          height={28}
        />
      ) : (
        <span aria-hidden="true">{initials(user.name)}</span>
      )}
      <span>{user.name}</span>
    </span>
  )
}

export default function PresenceIndicatorIsland({
  pagePath,
  'data-testid': testId = 'presence-indicator',
}: PresenceIndicatorIslandProps): ReactElement {
  const [users, setUsers] = useState<readonly PresenceUser[]>([])

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
        setUsers((current) => applyPresenceMessage(current, parsed))
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
      data-presence-count={users.length}
      aria-label="Users viewing this page"
    >
      {users.map((user) => (
        <PresenceChip
          key={user.id}
          user={user}
        />
      ))}
    </div>
  )
}
