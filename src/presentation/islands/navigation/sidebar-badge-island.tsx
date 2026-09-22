/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'

/**
 * The live count beside a sidebar entry.
 *
 * The other branch of `SidebarNavItem.badge` is a literal, which the server
 * renders and this island never sees. A COUNT cannot be a literal: it is stale
 * the moment the config is written, so it is read from an endpoint — and an
 * endpoint read means the client, because the count is per-operator and often
 * per-session.
 *
 * Islanded on its own, rather than folded into `sidebar-groups`, because the
 * two mount in different places: a badge sits INSIDE an authored, fully
 * server-rendered entry, while `sidebar-groups` replaces a group's fetched
 * half. Sharing one island would mean one marker doing two unrelated jobs.
 */

interface SidebarBadgeIslandProps {
  /** Read endpoint whose response carries the count. */
  readonly endpoint?: string
  /** Dot path to the count inside the response envelope. */
  readonly valuePath?: string
}

/**
 * Read a dot path out of a response envelope.
 *
 * Returns `undefined` for a path that does not resolve or resolves to something
 * that is not a number — a badge showing `[object Object]` is worse than one
 * showing nothing.
 */
function readPath(body: unknown, path: string): number | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      body
    )
  if (typeof value === 'number' && Number.isFinite(value)) return value
  // A count arriving as a string is the ordinary shape of a Postgres `int8`, so
  // it is accepted rather than dropped.
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return undefined
}

/**
 * GET the endpoint and read the count.
 *
 * Never throws and never surfaces an error state: a badge that cannot be read
 * renders nothing, leaving the entry exactly as the server drew it. A nav entry
 * is navigation first, and a failed count must not take it down.
 * `credentials: 'include'` so an admin read endpoint authorizes the request.
 */
async function fetchCount(endpoint: string, valuePath: string): Promise<number | undefined> {
  try {
    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    return readPath(await response.json(), valuePath)
  } catch {
    return undefined
  }
}

export default function SidebarBadgeIsland({
  endpoint,
  valuePath = 'total',
}: SidebarBadgeIslandProps): string | undefined {
  const [count, setCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (endpoint === undefined) return
    // eslint-disable-next-line functional/no-let -- unmount guard for the async setState
    let live = true
    void fetchCount(endpoint, valuePath).then((value) => {
      if (live) setCount(value)
    })
    return () => {
      live = false
    }
  }, [endpoint, valuePath])

  // The host `<span>` is server-rendered with the badge's own styling, so the
  // island contributes the number and nothing else — wrapping it in an element
  // here would nest a second badge inside the first.
  if (count === undefined) return undefined
  return String(count)
}
