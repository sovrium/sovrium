/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bounds a declared — still untrusted — MCP server cannot talk its way
 * past during a `tools/call` (`mcp-tool-call.ts`): how many requests it may
 * send on one call, and how many calls may wait on a person at once.
 */

/** The calls paused on a person, counted across one client. */
export interface PausedCalls {
  readonly acquire: () => boolean
  readonly release: () => void
}

/** The most calls paused on a person at once, per client: the chat's held-turn registry size. */
export const MAX_PAUSED_CALLS = 1000

/** The most requests a server may send on one call before the call fails. */
export const MAX_SERVER_REQUESTS = 100

/** A counter of paused calls, at most `limit` at once. */
export const makePausedCalls = (limit = MAX_PAUSED_CALLS): PausedCalls => {
  let count = 0
  return {
    acquire: () => {
      if (count >= limit) return false
      count += 1
      return true
    },
    release: () => {
      count = Math.max(0, count - 1)
    },
  }
}
