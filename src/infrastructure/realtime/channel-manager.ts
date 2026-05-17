/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory channel subscription manager.
 *
 * Manages which users are subscribed to which channels.
 * This is an in-process implementation — for horizontal scaling,
 * replace with Redis pub/sub or a dedicated message broker.
 */

const subscriptions = new Map<string, Set<string>>()

export const addSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel) ?? new Set()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
  subs.add(userId)
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
  subscriptions.set(channel, subs)
}

export const removeSubscription = (channel: string, userId: string): void => {
  const subs = subscriptions.get(channel)
  if (subs) {
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where
    subs.delete(userId)
    if (subs.size === 0) {
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where
      subscriptions.delete(channel)
    }
  }
}

export const getSubscribers = (channel: string): readonly string[] => [
  ...(subscriptions.get(channel) ?? []),
]

/** @public */
export const getChannelCount = (): number => subscriptions.size
