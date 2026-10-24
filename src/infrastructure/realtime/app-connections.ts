/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app connections — one WebSocket per open page of a signed-in reader
 * (`/api/realtime/connection`) — counted per person, and the channels their
 * events travel on.
 *
 * A person is online while one of her app connections is open: the count is
 * process-local, as the realtime fan-out is. Each count is keyed by the app's
 * name, so two apps sharing a process never see each other's people.
 */

/** Open app connections per `app\u0000user`. A person with none has no entry. */
const openCounts = new Map<string, number>()

const keyOf = (appId: string, userId: string): string => `${appId}\u0000${userId}`

/** The channel presence changes of an app travel on. */
export const appPresenceChannel = (appId: string): string => `app-presence:${appId}`

/**
 * One person's notifications channel: a change to her notifications, sent to
 * her own app connections only. Keyed by her id alone — an account id is
 * unique, so two apps in one process never share it.
 */
export const userNotificationsChannel = (userId: string): string => `user-notifications:${userId}`

/** The channel one record's live events travel on: its comment changes and its typing. */
export const recordActivityChannel = (appId: string, table: string, recordId: string): string =>
  `record-activity:${appId}:${table}:${recordId}`

/** Count one more open connection for a person; `true` when it is her first. */
export const connectPerson = (appId: string, userId: string): boolean => {
  const key = keyOf(appId, userId)
  const count = (openCounts.get(key) ?? 0) + 1
  openCounts.set(key, count)
  return count === 1
}

/** Count one connection fewer; `true` when it was her last. */
export const disconnectPerson = (appId: string, userId: string): boolean => {
  const key = keyOf(appId, userId)
  const count = (openCounts.get(key) ?? 0) - 1
  if (count > 0) {
    openCounts.set(key, count)
    return false
  }
  openCounts.delete(key)
  return true
}

/** Whether one of the person's app connections is open. */
export const isPersonOnline = (appId: string, userId: string): boolean =>
  (openCounts.get(keyOf(appId, userId)) ?? 0) > 0

/** The ids of the app's people with an open app connection, in no particular order. */
export const onlinePeopleOf = (appId: string): readonly string[] => {
  const prefix = keyOf(appId, '')
  return [...openCounts.keys()]
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
}
