/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { publishToChannel } from './channel-manager'
import type { RealtimePresenceEntry } from '@/domain/models/api/realtime/realtime'

export const presenceChannel = (appId: string, pagePath: string): string =>
  `app:${appId}:presence:${pagePath}`

interface TrackedEntry {
  readonly entry: RealtimePresenceEntry
  lastSeen: number
}

const pages = new Map<string, Map<string, TrackedEntry>>()

const snapshotEntries = (appId: string, pagePath: string): readonly RealtimePresenceEntry[] => {
  const page = pages.get(presenceChannel(appId, pagePath))
  if (!page) return []
  return [...page.values()].map((tracked) => tracked.entry)
}

const evictOldestForCapacity = (
  page: Map<string, TrackedEntry>,
  appId: string,
  pagePath: string
): void => {
  const overBy = page.size - (REALTIME_TRANSPORT_CONFIG.maxPresenceEntriesPerPage - 1)
  if (overBy <= 0) return
  const oldestFirst = [...page.entries()].toSorted(([, a], [, b]) => a.lastSeen - b.lastSeen)
  oldestFirst.slice(0, overBy).forEach(([connectionId, tracked]) => {
    page.delete(connectionId)
    publishToChannel(presenceChannel(appId, pagePath), {
      type: 'leave',
      userId: tracked.entry.id,
      pagePath,
    })
  })
}

export const joinPresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
  readonly entry: RealtimePresenceEntry
}): readonly RealtimePresenceEntry[] => {
  const { appId, connectionId, pagePath, entry } = params
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey) ?? new Map<string, TrackedEntry>()
  pages.set(channelKey, page)

  evictOldestForCapacity(page, appId, pagePath)

  page.set(connectionId, { entry, lastSeen: Date.now() })

  publishToChannel(channelKey, { type: 'join', user: entry })

  return snapshotEntries(appId, pagePath)
}

export const leavePresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
}): void => {
  const { appId, connectionId, pagePath } = params
  const channelKey = presenceChannel(appId, pagePath)
  const page = pages.get(channelKey)
  if (!page) return
  const tracked = page.get(connectionId)
  if (!tracked) return
  page.delete(connectionId)
  if (page.size === 0) {
    pages.delete(channelKey)
  }
  publishToChannel(channelKey, {
    type: 'leave',
    userId: tracked.entry.id,
    pagePath,
  })
}

export const touchPresence = (params: {
  readonly appId: string
  readonly connectionId: string
  readonly pagePath: string
}): void => {
  const { appId, connectionId, pagePath } = params
  const tracked = pages.get(presenceChannel(appId, pagePath))?.get(connectionId)
  if (tracked) tracked.lastSeen = Date.now()
}

const reapStalePresence = (now: number = Date.now()): void => {
  const staleBefore = now - REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs
  pages.forEach((page, channelKey) => {
    const presencePrefixEnd = channelKey.indexOf(':presence:')
    const pagePath =
      presencePrefixEnd >= 0
        ? channelKey.slice(presencePrefixEnd + ':presence:'.length)
        : channelKey
    ;[...page.entries()].forEach(([connectionId, tracked]) => {
      if (tracked.lastSeen >= staleBefore) return
      page.delete(connectionId)
      publishToChannel(channelKey, {
        type: 'leave',
        userId: tracked.entry.id,
        pagePath,
      })
    })
    if (page.size === 0) {
      pages.delete(channelKey)
    }
  })
}


let reapTimer: ReturnType<typeof setInterval> | undefined

export const startPresenceReaper = (): void => {
  if (reapTimer !== undefined) return
  reapTimer = setInterval(() => {
    reapStalePresence()
  }, REALTIME_TRANSPORT_CONFIG.presenceStaleTimeoutMs)
  if (typeof reapTimer.unref === 'function') reapTimer.unref()
}
