/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { open, readFile, rm, stat } from 'node:fs/promises'
import { EngineRefusal } from './instance-engine-release'

/**
 * The locks of the engine store: a file created exclusively and holding its
 * owner's pid, so it holds across processes, and one left by a process that
 * died is taken over instead of blocking every later install.
 *
 * Taking a dead owner's lock over is itself guarded. Two waiters can both find
 * the same lock stale; if each simply removed it, the second would remove the
 * fresh lock the first had just created, and both would hold it. So only the
 * waiter that creates `<lock>.reap` exclusively may remove a stale lock, and
 * it judges the lock stale again once it holds that guard.
 */

/** How long a caller waits for another process holding the same lock. */
const LOCK_WAIT_MS = 15 * 60_000

/** How often a waiting caller looks at the lock again. */
const LOCK_POLL_MS = 100

/** A lock with no pid written yet is its creator's for this long. */
const LOCK_FRESH_MS = 60_000

/** A takeover guard is held for one read and one remove; older than this, its holder died. */
const REAP_FRESH_MS = 10_000

const codeOf = (cause: unknown): string | undefined =>
  (cause as { readonly code?: string } | null)?.code

/** Whether the process `pid` still runs on this host. */
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return codeOf(cause) === 'EPERM'
  }
}

/** Whether the lock at `path` was left by a process that no longer runs. */
const isStaleLock = async (path: string): Promise<boolean> => {
  const [text, info] = await Promise.all([
    readFile(path, 'utf8').catch(() => ''),
    stat(path).catch(() => undefined),
  ])
  if (info === undefined) return false
  const pid = Number(text.trim())
  return Number.isInteger(pid) && pid > 0
    ? !isAlive(pid)
    : Date.now() - info.mtimeMs > LOCK_FRESH_MS
}

/** Create `path` exclusively, writing this process's pid; `false` when it exists. */
const createExclusive = async (path: string): Promise<boolean> => {
  const handle = await open(path, 'wx').catch((cause: unknown) => {
    if (codeOf(cause) === 'EEXIST') return undefined
    throw cause
  })
  if (handle === undefined) return false
  await handle.writeFile(String(process.pid)).finally(() => handle.close())
  return true
}

/** Remove the guard at `reap` when its holder died mid-takeover. */
const dropDeadGuard = async (reap: string): Promise<void> => {
  const info = await stat(reap).catch(() => undefined)
  if (info !== undefined && Date.now() - info.mtimeMs > REAP_FRESH_MS) {
    await rm(reap, { force: true })
  }
}

/**
 * Remove the lock at `path` if it is stale, holding the takeover guard while
 * judging it; `false` when another waiter is already taking it over.
 */
const reapStaleLock = async (path: string): Promise<boolean> => {
  const reap = `${path}.reap`
  if (!(await createExclusive(reap))) {
    await dropDeadGuard(reap)
    return false
  }
  try {
    if (await isStaleLock(path)) await rm(path, { force: true })
    return true
  } finally {
    await rm(reap, { force: true })
  }
}

/** Take the lock at `path`, waiting while a live process holds it. */
export const acquireLock = async (path: string, subject: string): Promise<void> => {
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    if (await createExclusive(path)) return
    if ((await isStaleLock(path)) && (await reapStaleLock(path))) continue
    if (Date.now() > deadline) {
      throw new EngineRefusal(
        `instance: ${subject}: another process has held ${path} for more than ${String(LOCK_WAIT_MS / 60_000)} minutes`
      )
    }
    await Bun.sleep(LOCK_POLL_MS)
  }
}
