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
 * held by the running server's realtime hub (`./current-realtime-hub`), as the
 * fan-out is, and starts empty with each server. Each count is keyed by the
 * app's name, so two apps sharing a process never see each other's people.
 */

import { currentRealtimeHub } from './current-realtime-hub'

/** One hub's open app connections, per person. */
export interface AppConnectionCounts {
  /** Count one more open connection for a person; `true` when it is her first. */
  readonly connect: (appId: string, userId: string) => boolean
  /** Count one connection fewer; `true` when it was her last. */
  readonly disconnect: (appId: string, userId: string) => boolean
  readonly isOnline: (appId: string, userId: string) => boolean
  readonly onlineOf: (appId: string) => readonly string[]
  /** Forget every count — the hub's release. */
  readonly clear: () => void
}

const keyOf = (appId: string, userId: string): string => `${appId}\u0000${userId}`

/** A fresh registry in which nobody is online. */
export const makeAppConnectionCounts = (): AppConnectionCounts => {
  /** Open app connections per `app\u0000user`. A person with none has no entry. */
  const openCounts = new Map<string, number>()
  return {
    connect: (appId, userId) => {
      const key = keyOf(appId, userId)
      const count = (openCounts.get(key) ?? 0) + 1
      openCounts.set(key, count)
      return count === 1
    },
    disconnect: (appId, userId) => {
      const key = keyOf(appId, userId)
      const count = (openCounts.get(key) ?? 0) - 1
      if (count > 0) {
        openCounts.set(key, count)
        return false
      }
      openCounts.delete(key)
      return true
    },
    isOnline: (appId, userId) => (openCounts.get(keyOf(appId, userId)) ?? 0) > 0,
    onlineOf: (appId) => {
      const prefix = keyOf(appId, '')
      return [...openCounts.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
    },
    clear: () => {
      openCounts.clear()
    },
  }
}

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

/** One open app connection, counted for its person in the hub it opened on. */
export interface PersonConnection {
  /** Whether it is her first open connection. */
  readonly first: boolean
  /**
   * Count it out; `true` when it was her last. Acts on the hub it was counted
   * in, even once that server has stopped, and counts out once.
   */
  readonly disconnect: () => boolean
}

const UNCOUNTED: PersonConnection = { first: false, disconnect: () => false }

/**
 * Count one more open connection for a person on the running server. With no
 * server running nothing is counted, and it is never her first.
 */
export const connectPerson = (appId: string, userId: string): PersonConnection => {
  const people = currentRealtimeHub()?.people
  if (people === undefined) return UNCOUNTED
  const first = people.connect(appId, userId)
  const state = { counted: true }
  return {
    first,
    disconnect: () => {
      if (!state.counted) return false
      state.counted = false
      return people.disconnect(appId, userId)
    },
  }
}

/** Whether one of the person's app connections is open. */
export const isPersonOnline = (appId: string, userId: string): boolean =>
  currentRealtimeHub()?.people.isOnline(appId, userId) ?? false

/** The ids of the app's people with an open app connection, in no particular order. */
export const onlinePeopleOf = (appId: string): readonly string[] =>
  currentRealtimeHub()?.people.onlineOf(appId) ?? []
