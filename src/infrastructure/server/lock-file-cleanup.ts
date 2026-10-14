/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync, rmSync } from 'node:fs'
import { getLockFilePath } from '@/infrastructure/server/lock-file'
import { removeStatusFileSync } from '@/infrastructure/server/status-file'

type CleanupSignal = 'SIGTERM' | 'SIGINT' | 'SIGUSR1'

/**
 * The one process capability this module needs.
 *
 * @internal Injection seam for `lock-file-cleanup.test.ts` only — production
 * code goes through {@link registerLockFileCleanup}, which is bound to the
 * real process. Installing real signal handlers from a unit test would leave
 * them on the `bun test` runner for the rest of the suite.
 */
export interface CleanupProcess {
  readonly on: (signal: CleanupSignal, handler: () => void) => void
}

const nodeProcess: CleanupProcess = {
  on: (signal, handler) => {
    process.on(signal, handler)
  },
}

/**
 * Synchronous sidecar cleanup — removes the lock file and the status file, each
 * only if its own PID matches.
 *
 * BOTH, in one handler rather than two registrations. The two files answer the
 * same question — is there an instance — so any window in which one is gone and
 * the other still reads `serving` is a window in which a reader believes
 * whichever it happened to open. Removing them together closes it.
 *
 * A module-level constant, so the same function reference is handed to every
 * signal registration.
 *
 * Exported because the signal handlers below are no longer the only way a
 * server stops: `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE` adds an EOF trigger that
 * reaches the graceful stop without any signal ever being delivered, and the
 * shutdown controller calls this directly so BOTH triggers leave the same state
 * behind. Idempotent and guarded by the PID check, so the signal path calling
 * it twice costs nothing.
 */
export const cleanupLockFileSync = (): void => {
  try {
    const lockPath = getLockFilePath()
    const raw = readFileSync(lockPath, 'utf-8')
    const data = JSON.parse(raw) as { pid: number }
    if (data.pid === process.pid) {
      rmSync(lockPath, { force: true })
    }
  } catch {
    // Ignore errors during cleanup (file may not exist)
  }
  // Outside the try above, deliberately: a lock file that was already gone —
  // removed by hand, or by an earlier signal — must not leave the status file
  // behind claiming to be serving. `removeStatusFileSync` guards on its own
  // pid and swallows its own errors.
  removeStatusFileSync()
}

/** A controller owning one process' lock-file and reload signal handlers. */
export interface LockFileCleanupController {
  /** Install the SIGTERM, SIGINT and SIGUSR1 handlers — once, however often it is called. */
  readonly register: () => void
  /** Name what SIGUSR1 runs; a later call replaces the earlier one. */
  readonly onReloadRequest: (request: () => void) => void
}

/**
 * Build a lock-file cleanup controller over the given process capabilities.
 *
 * Contract, mirroring {@link createShutdownController} in `./lifecycle.ts`:
 *
 * 1. **Handlers are installed once.** A restart-class reload re-enters
 *    `createServer`, which registers again; a second `register` installs
 *    nothing. Before this, each reload added three more listeners, every one
 *    closing over a superseded app that then stayed reachable from
 *    `process._events` for the life of the process — thirteen reloads
 *    measured 39 listeners, and Bun emits no `MaxListenersExceededWarning`.
 * 2. **SIGUSR1 runs the reload path `sovrium start` holds** (see
 *    `start-watch.ts`), read at signal time, so the one installed listener
 *    serves every reload. It does nothing else: the header hash, the lock file
 *    and `status.json` are written by that path once the server has decided,
 *    so the three always name the configuration that is running. A process
 *    that holds no reload path (no config file) ignores the signal.
 * 3. **SIGTERM/SIGINT share one function reference.**
 *
 * @internal Exported for `lock-file-cleanup.test.ts`; use
 * {@link registerLockFileCleanup} and {@link onReloadRequest}.
 */
export const createLockFileCleanupController = (
  host: CleanupProcess = nodeProcess
): LockFileCleanupController => {
  // Single-key Maps rather than a mutable record: the repo's idiom for
  // per-process state that has to survive between calls without a `let` or a
  // mutable object type (see `./lifecycle.ts`).
  const requests = new Map<'reload', () => void>()
  const flags = new Map<'installed', true>()

  const onReloadSignal = (): void => {
    try {
      requests.get('reload')?.()
    } catch {
      // A signal handler must never throw: the reload path reports its own
      // failures, and the process keeps serving whatever it was serving.
    }
  }

  return {
    register: () => {
      if (flags.get('installed') === true) return
      flags.set('installed', true)
      host.on('SIGTERM', cleanupLockFileSync)
      host.on('SIGINT', cleanupLockFileSync)
      host.on('SIGUSR1', onReloadSignal)
    },
    onReloadRequest: (request) => {
      requests.set('reload', request)
    },
  }
}

const defaultController = createLockFileCleanupController()

/**
 * Register signal handlers that remove the lock file on graceful shutdown and
 * run the reload path on SIGUSR1. Safe to call once per `createServer`.
 */
export const registerLockFileCleanup = (): void => defaultController.register()

/** What SIGUSR1 — `sovrium reload` — runs in this process. */
export const onReloadRequest = (request: () => void): void =>
  defaultController.onReloadRequest(request)
