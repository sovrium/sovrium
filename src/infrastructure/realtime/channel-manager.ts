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
