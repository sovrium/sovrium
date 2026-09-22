/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFileSync, rmSync } from 'node:fs'
import { computeConfigHash, getLockFilePath } from '@/infrastructure/server/lock-file'
import type { Hono } from 'hono'

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
    // eslint-disable-next-line functional/no-expression-statements -- register a process signal handler
    process.on(signal, handler)
  },
}

/**
 * The single property `server.ts` bolts onto the Hono app so the reload
 * handler can refresh the `X-Sovrium-Config` header hash (see the middleware
 * that closes over `currentConfigHash` in `server.ts`).
 */
interface ConfigHashCarrier {
  readonly __setConfigHash?: (hash: string) => void
}

/**
 * Synchronous lock file cleanup — removes the lock file only if PID matches.
 *
 * A module-level constant, so the same function reference is handed to every
 * signal registration.
 */
const cleanupLockFileSync = (): void => {
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
}

/** The app + config file a reload signal currently applies to. */
interface ReloadTarget {
  readonly app: Readonly<Hono>
  readonly configPath: string
}

/** A controller owning one process' lock-file and reload signal handlers. */
export interface LockFileCleanupController {
  readonly register: (app: Readonly<Hono>, configPath: string) => void
}

/**
 * Build a lock-file cleanup controller over the given process capabilities.
 *
 * Contract, mirroring {@link createShutdownController} in `./lifecycle.ts`:
 *
 * 1. **Register has replace semantics.** `--watch` re-enters `createServer`
 *    on every save and hands over a fresh Hono app; a second `register` swaps
 *    the reload target and installs nothing. Before this, each reload added
 *    three more listeners — and the SIGUSR1 closure captured its app, so
 *    every superseded Hono instance (with its Better Auth instance and route
 *    table) stayed reachable from `process._events` for the life of the
 *    process. Thirteen reloads measured 39 listeners. Bun emits no
 *    `MaxListenersExceededWarning`, so the leak was entirely silent.
 * 2. **The reload handler reads the CURRENT target at signal time**, not the
 *    one captured when it was installed. That is what lets the single
 *    installed listener serve every subsequent reload.
 * 3. **SIGTERM/SIGINT share one function reference.** Deduplication could
 *    also be had with `process.off` before `process.on`, but the install-once
 *    flag covers all three signals uniformly and matches the sibling.
 *
 * @internal Exported for `lock-file-cleanup.test.ts`; use
 * {@link registerLockFileCleanup}.
 */
export const createLockFileCleanupController = (
  host: CleanupProcess = nodeProcess
): LockFileCleanupController => {
  // Single-key Maps rather than a mutable record: the repo's idiom for
  // per-process state that has to survive between calls without a `let` or a
  // mutable object type (see `./lifecycle.ts`).
  const targetState = new Map<'target', ReloadTarget>()
  const flags = new Map<'installed', true>()

  // Re-read config and update the X-Sovrium-Config response header hash.
  // Use the SYNCHRONOUS readFileSync so the setter runs atomically inside the
  // signal-handler tick — guarantees the new hash is observable to the next
  // HTTP request without an awaited microtask gap ([internal ref] was flaky
  // under load when the async readFile yielded back to the event loop and a
  // concurrent fetch was serviced with the still-old closure value).
  //
  // Config is code-only: the reload's sole effect is refreshing the
  // X-Sovrium-Config header hash from the file on disk. There is no version
  // ledger to append to.
  const onReloadSignal = (): void => {
    const target = targetState.get('target')
    if (!target || !target.configPath) return
    try {
      const content = readFileSync(target.configPath, 'utf-8')
      const newHash = computeConfigHash(content)
      const setter = (target.app as unknown as ConfigHashCarrier).__setConfigHash
      if (setter) setter(newHash)
    } catch {
      // Ignore errors during reload (header refresh is best-effort).
    }
  }

  return {
    register: (app, configPath) => {
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- replace the reload target on a --watch reload
      targetState.set('target', { app, configPath })
      if (flags.get('installed') === true) return
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- install-once guard
      flags.set('installed', true)
      host.on('SIGTERM', cleanupLockFileSync)
      host.on('SIGINT', cleanupLockFileSync)
      host.on('SIGUSR1', onReloadSignal)
    },
  }
}

const defaultController = createLockFileCleanupController()

/**
 * Register signal handlers that remove the lock file on graceful shutdown and
 * refresh the config hash on SIGUSR1.
 *
 * Call once per `createServer`. Later calls only swap the app and config path
 * a reload applies to (see {@link createLockFileCleanupController}).
 */
export const registerLockFileCleanup = (app: Readonly<Hono>, configPath: string): void =>
  defaultController.register(app, configPath)
