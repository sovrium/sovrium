/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Process GROUPS for the children `command-service.ts` starts.
 *
 * Signalling a child by PID reaches that one process and nothing it started.
 * Most gates are a wrapper over the real tool — `bunx prettier` execs `node`,
 * `sh -c` forks its command — so a timeout that SIGTERMs the wrapper leaves the
 * tool re-parented to init and still running. Observed 2026-10-16: Prettier
 * timed out, the quality run stopped, and `node .../prettier --check .` kept
 * 40 % of a core for eight more minutes on an already saturated machine.
 *
 * The fix is the POSIX one. Each child is spawned `detached` — Bun calls
 * `setsid()`, so the child leads a new session and process group whose id is
 * its own PID — and every signal goes to `-pid`, the whole group. A grandchild
 * stays in the group unless it deliberately calls `setsid()` itself (daemons
 * do; gate tools do not), so this kills by ANCESTRY, never by a name pattern
 * that would also match the same command in another worktree.
 *
 * A new session has a cost the old shape did not: the terminal's ^C no longer
 * reaches the child, because the tty signals only its foreground group. So the
 * groups that are alive are tracked here and the signal is FORWARDED:
 *
 *   - SIGINT / SIGTERM / SIGHUP go to every live group. When nothing else in
 *     the process listens for that signal, the process then exits as it would
 *     have by default (128 + signo), after a grace that SIGKILLs any survivor.
 *     When something else listens (the quality lock does), that listener owns
 *     the exit and this one only forwards.
 *   - On `exit` — any `process.exit()`, which closes no Effect scope, so no
 *     release runs — every live group gets SIGTERM at once and a detached
 *     reaper delivers SIGKILL after the grace, since an exit handler cannot
 *     wait.
 *
 * Windows has no process groups to signal this way, so `detached` is not used
 * there and callers fall back to signalling the direct child.
 */

import { spawn as bunSpawn } from 'bun'

/** Whether this platform can signal a whole process group via a negative PID. */
export const PROCESS_GROUPS_SUPPORTED = process.platform !== 'win32'

/** Grace between the forwarded signal and SIGKILL when this module owns the exit. */
const FORWARD_GRACE_MS = 2000

type GroupSignal = NodeJS.Signals | 0

/**
 * Send `signal` to every process in the group led by `pgid`.
 *
 * @returns `false` when the group no longer exists (ESRCH) or cannot be
 *   signalled, `true` otherwise. Never throws: callers run this from release
 *   paths, where a throw would mask the failure being cleaned up after.
 */
export const signalGroup = (pgid: number, signal: GroupSignal): boolean => {
  if (!PROCESS_GROUPS_SUPPORTED || pgid <= 0) return false
  try {
    process.kill(-pgid, signal)
    return true
  } catch {
    return false
  }
}

/** Whether any process of the group led by `pgid` is still alive (signal 0 delivers nothing). */
export const isGroupAlive = (pgid: number): boolean => signalGroup(pgid, 0)

// ─── Live-group registry and signal forwarding ───────────────────────────────

const liveGroups = new Set<number>()

const FORWARDED_SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 } as const
type ForwardedSignal = keyof typeof FORWARDED_SIGNALS

let hooksInstalled = false
let exitScheduled = false

const signalAll = (signal: GroupSignal): void => {
  for (const pgid of liveGroups) signalGroup(pgid, signal)
}

/**
 * SIGKILL the groups still alive `graceMs` after this process has gone.
 *
 * An `exit` handler runs synchronously and cannot wait, so the wait happens in
 * a detached `/bin/sh` that outlives us. It is spawned with every stdio
 * ignored so it holds nothing of ours open, and `kill` on a group that has
 * already died is a harmless error.
 */
const spawnReaper = (groups: readonly number[], graceMs: number): void => {
  if (groups.length === 0) return
  const seconds = Math.max(1, Math.ceil(graceMs / 1000))
  const targets = groups.map((pgid) => `-${pgid}`).join(' ')
  try {
    bunSpawn(['/bin/sh', '-c', `sleep ${seconds}; kill -KILL -- ${targets} 2>/dev/null`], {
      detached: true,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    }).unref()
  } catch {
    // Nothing more can be done from inside an exit handler.
  }
}

const onExit = (): void => {
  if (liveGroups.size === 0) return
  signalAll('SIGTERM')
  spawnReaper([...liveGroups], FORWARD_GRACE_MS)
}

const onForwardedSignal = (signal: ForwardedSignal): void => {
  signalAll(signal)
  // Another listener (the quality lock, a script's own handler) owns the exit.
  if (process.listenerCount(signal) > 1) return
  const code = 128 + FORWARDED_SIGNALS[signal]
  // A second ^C while the grace runs means "now".
  if (exitScheduled) process.exit(code)
  exitScheduled = true
  setTimeout(() => {
    signalAll('SIGKILL')
    process.exit(code)
  }, FORWARD_GRACE_MS)
}

const installHooks = (): void => {
  if (hooksInstalled) return
  hooksInstalled = true
  process.on('exit', onExit)
  for (const signal of Object.keys(FORWARDED_SIGNALS) as ForwardedSignal[]) {
    process.on(signal, () => onForwardedSignal(signal))
  }
}

/**
 * Record a live group so a signal or an abrupt exit reaches it.
 *
 * @returns the function that forgets it, called once the group is gone.
 */
export const trackGroup = (pgid: number): (() => void) => {
  if (!PROCESS_GROUPS_SUPPORTED || pgid <= 0) return () => undefined
  liveGroups.add(pgid)
  installHooks()
  return () => {
    liveGroups.delete(pgid)
  }
}
