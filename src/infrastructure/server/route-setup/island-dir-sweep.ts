/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Naming and reclamation for the per-process dev island build directories.
 *
 * The island bundle is built into `<tmpdir>/sovrium-islands-<pid>`, one
 * directory per server process — see `ISLAND_OUT_DIR` in `static-assets.ts` for
 * why the pid is load-bearing. Nothing removes those directories when a server
 * exits, and each holds ~126 build outputs (~7.6 MB), so they accumulate: a
 * single 21-test Playwright run leaves 21 behind, and a full suite would reach
 * several GB.
 *
 * A shutdown hook cannot close this. The graceful SIGTERM path would cover an
 * interactive Ctrl-C, but test fixtures escalate to SIGKILL a second later and a
 * crash never runs a handler at all — so the directories that pile up fastest
 * are precisely the ones a hook would miss. Sweeping siblings whose pid is no
 * longer alive is self-healing instead: it collects the leftovers of every kind
 * of exit, including the ones nobody got to handle.
 *
 * The naming lives here rather than at the build site because a sweep that
 * disagrees with the builder about the directory name is worse than no sweep —
 * it would either miss everything or delete a live server's bundle.
 */

/** Builds the island build-directory name for a given server process. */
export const islandDirName = (pid: number): string => `sovrium-islands-${pid}`

/** Matches a per-process island directory and captures its pid. */
const ISLAND_DIR_PATTERN = /^sovrium-islands-(\d+)$/

/**
 * The single shared directory used before the per-process scheme. A server
 * running an older build still writes here, so it is removed only once it has
 * gone quiet (see {@link legacyDirIsIdle}).
 */
const LEGACY_ISLAND_DIR = 'sovrium-islands'

/**
 * Ceiling on removals per sweep. Each removal is a recursive delete of ~126
 * files, and this runs on the first island build of a process, so an unbounded
 * sweep across a tmpdir holding hundreds of leftovers would stall the first
 * response. Whatever is left over is collected by the next process to start.
 */
const DEFAULT_MAX_REMOVALS = 64

/** A legacy directory untouched for this long is treated as abandoned. */
const DEFAULT_LEGACY_IDLE_MS = 60 * 60 * 1000

/** Entries sampled when dating the legacy directory. */
const LEGACY_MTIME_SAMPLE = 256

/**
 * Whether `pid` still names a running process.
 *
 * Signal 0 runs the kernel's existence and permission checks without delivering
 * anything. Only `ESRCH` ("no such process") proves the process is gone: `EPERM`
 * means it is alive but owned by another user, whose directory is not ours to
 * reclaim. Every other outcome is read as alive, because the cost of a false
 * "dead" is deleting a running server's bundle, while the cost of a false
 * "alive" is one directory surviving until the next sweep.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    // eslint-disable-next-line functional/no-expression-statements
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Injection seams — defaulted in production, supplied by the unit tests. */
export interface IslandDirSweepOptions {
  readonly parentDir?: string
  readonly selfPid?: number
  readonly isAlive?: (pid: number) => boolean
  readonly now?: number
  readonly legacyIdleMs?: number
  readonly maxRemovals?: number
}

/**
 * Whether the legacy shared directory has gone untouched for `idleMs`.
 *
 * Dated by the newest entry inside it, NOT by the directory's own mtime: a
 * directory's mtime moves only when entries are added or removed, and a rebuild
 * overwrites the same filenames in place. The directory can therefore look
 * untouched for hours while an older server rewrites every file inside it on
 * every request.
 */
async function legacyDirIsIdle(dir: string, now: number, idleMs: number): Promise<boolean> {
  const names = await readdir(dir).catch(() => [] as string[])
  if (names.length === 0) return true

  const mtimes = await Promise.all(
    names.slice(0, LEGACY_MTIME_SAMPLE).map((name) =>
      stat(join(dir, name))
        .then((entry) => entry.mtimeMs)
        .catch(() => 0)
    )
  )

  return now - Math.max(...mtimes) > idleMs
}

/**
 * Removes island build directories left behind by processes that have exited,
 * plus the legacy shared directory once it has gone quiet.
 *
 * Never throws: a tmpdir that cannot be read, or an entry that cannot be
 * deleted, yields a shorter result rather than an error. Reclaiming disk is
 * housekeeping, and a cleanup step that can prevent a server from starting is
 * worse than the leak it fixes.
 *
 * One race is accepted knowingly: a process could exit between the liveness
 * check and the delete (correct — the directory is then genuinely abandoned), or
 * a brand-new process could claim the same pid in that window and lose its
 * freshly built bundle. The latter needs pid reuse inside a few milliseconds,
 * and dev rebuilds on the next request anyway.
 *
 * @returns the directory names actually removed
 */
export async function sweepStaleIslandDirs(
  options: IslandDirSweepOptions = {}
): Promise<readonly string[]> {
  const {
    parentDir = tmpdir(),
    selfPid = process.pid,
    isAlive = isProcessAlive,
    now = Date.now(),
    legacyIdleMs = DEFAULT_LEGACY_IDLE_MS,
    maxRemovals = DEFAULT_MAX_REMOVALS,
  } = options

  const entries = await readdir(parentDir).catch(() => [] as string[])

  const abandoned = entries.filter((name) => {
    const match = ISLAND_DIR_PATTERN.exec(name)
    if (match === null) return false
    const pid = Number(match[1])
    // pid 0 addresses the caller's whole process group under POSIX, so it is
    // never a safe argument to a liveness probe.
    return pid > 0 && pid !== selfPid && !isAlive(pid)
  })

  const legacyIsCollectable =
    entries.includes(LEGACY_ISLAND_DIR) &&
    (await legacyDirIsIdle(join(parentDir, LEGACY_ISLAND_DIR), now, legacyIdleMs))

  const targets = [...abandoned, ...(legacyIsCollectable ? [LEGACY_ISLAND_DIR] : [])].slice(
    0,
    maxRemovals
  )

  const outcomes = await Promise.allSettled(
    targets.map((name) => rm(join(parentDir, name), { recursive: true, force: true }))
  )

  return targets.filter((_, index) => outcomes[index]?.status === 'fulfilled')
}
