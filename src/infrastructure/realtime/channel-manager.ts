/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */




const subscriptions = new Map<string, Set<string>>()

export const addSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel) ?? new Set()
  subs.add(userId)
  subscriptions.set(channel, subs)
}

export const removeSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel)
  if (subs) {
    subs.delete(userId)
    if (subs.size === 0) {
      subscriptions.delete(channel)
    }
  }
}

export const getSubscribers = (channel: string): readonly string[] => [
  ...(subscriptions.get(channel) ?? []),
]

export const getChannelCount = (): number => subscriptions.size


type ChannelListener = (event: Record<string, unknown>) => void

const listeners = new Map<string, Set<ChannelListener>>()

export const addChannelListener = (channel: string, listener: ChannelListener): (() => void) => {
  const set = listeners.get(channel) ?? new Set()
  set.add(listener)
  listeners.set(channel, set)
  return () => {
    const current = listeners.get(channel)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) {
      listeners.delete(channel)
    }
  }
}

export const publishToChannel = (channel: string, event: Record<string, unknown>): void => {
  const set = listeners.get(channel)
  if (!set) return
  const snapshot = [...set]
  snapshot.forEach((listener) => {
    try {
      listener(event)
    } catch {
    }
  })
}

export const getChannelListenerCount = (channel: string): number =>
  listeners.get(channel)?.size ?? 0
