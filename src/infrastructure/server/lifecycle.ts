/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { logError, logInfo, logWarning } from '@/infrastructure/logging'
import type { ServerInstance } from '@/application/models/server'

/**
 * Hard ceiling on a graceful stop.
 *
 * Every supervisor that sends SIGTERM already runs a grace timer of its own
 * (`docker stop` 10 s, systemd `TimeoutStopSec` 90 s, the E2E fixture 500 ms)
 * and follows it with SIGKILL. Exiting ourselves a little sooner keeps the
 * shutdown path OURS: the lock file is removed, the exit code is meaningful,
 * and the operator sees a reason instead of a signal.
 */
const SHUTDOWN_WATCHDOG_MS = 5000

type ShutdownSignal = 'SIGINT' | 'SIGTERM'

/**
 * The three process-level capabilities the controller needs.
 *
 * @internal Injection seam for `lifecycle.test.ts` only — production code goes
 * through {@link installShutdownHandlers}, which is bound to the real process.
 * Installing real `process.exit` handlers from a unit test would end the `bun
 * test` runner mid-suite.
 */
export interface ShutdownProcess {
  readonly on: (signal: ShutdownSignal, handler: () => void) => void
  readonly exit: (code: number) => void
  readonly schedule: (handler: () => void, ms: number) => { readonly unref: () => void }
}

const nodeProcess: ShutdownProcess = {
  on: (signal, handler) => {
    // eslint-disable-next-line functional/no-expression-statements -- register a process signal handler
    process.on(signal, handler)
  },
  exit: (code) => {
    // eslint-disable-next-line functional/no-expression-statements -- terminate the process
    process.exit(code)
  },
  schedule: (handler, ms) => setTimeout(handler, ms),
}

/** A controller owning one process' signal handlers. */
export interface ShutdownController {
  readonly install: (server: ServerInstance) => Effect.Effect<void>
}

/**
 * Build a shutdown controller over the given process capabilities.
 *
 * Contract, in the order the failure modes were found:
 *
 * 1. **The handler must live on the boot fiber, not a child of it.** The
 *    previous implementation forked a fiber that parked on `Effect.never` to
 *    keep the process alive; Effect 4 interrupts a child when its parent
 *    completes, so the `process.on(...)` inside it never ran and the server
 *    ignored SIGTERM entirely. `install` is therefore a plain `Effect.sync`
 *    that registers and returns — nothing to interrupt.
 * 2. **Registering a signal listener cancels default termination.** Once ANY
 *    SIGTERM listener exists — and one already did, for lock-file cleanup —
 *    the process no longer dies on its own, so somebody has to call
 *    `process.exit`. That is the whole reason this file exits explicitly.
 * 3. **Install has replace semantics.** `--watch` re-enters `start()` and
 *    hands over a fresh server; a second `install` swaps the stop target and
 *    registers nothing, so handlers never stack across reloads.
 * 4. **A second signal is an order, not a repeat.** An operator pressing
 *    Ctrl-C twice wants out now; the second one exits immediately (1) rather
 *    than queueing another stop behind the first.
 *
 * Exit codes: 0 on a clean stop, 1 on a failed stop, on the watchdog, and on
 * the second signal. Not 143 — once the signal is handled, a clean stop is a
 * success to every supervisor that reads the code.
 *
 * @internal Exported for `lifecycle.test.ts`; use {@link installShutdownHandlers}.
 */
export const createShutdownController = (
  host: ShutdownProcess = nodeProcess
): ShutdownController => {
  // Single-key Maps rather than a mutable record: the repo's idiom for
  // per-process state that has to survive between calls without a `let` or a
  // mutable object type (see `telemetry/error-reporter.ts`).
  const targetState = new Map<'server', ServerInstance>()
  const flags = new Map<'installed' | 'signalled', true>()

  const onSignal = (signal: ShutdownSignal) => (): void => {
    if (flags.get('signalled') === true) {
      logWarning(`[server] received ${signal} again — exiting immediately`)
      host.exit(1)
      return
    }
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- set-once guard
    flags.set('signalled', true)
    logInfo(`[server] received ${signal} — stopping`)

    const watchdog = host.schedule(() => {
      logError('[server] shutdown timed out — exiting')
      host.exit(1)
    }, SHUTDOWN_WATCHDOG_MS)
    // A referenced timer would hold the loop open for the full watchdog window
    // AFTER an already-clean stop, turning a 50 ms shutdown into a 5 s one.
    watchdog.unref()

    const target = targetState.get('server')
    const stopped = target ? Effect.runPromise(target.stop) : Promise.resolve()
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget: the continuations end the process
    void stopped.then(
      () => {
        host.exit(0)
      },
      (error: unknown) => {
        logError('[server] stop failed', error)
        host.exit(1)
      }
    )
  }

  return {
    install: (server) =>
      Effect.sync(() => {
        // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- replace the stop target on a --watch reload
        targetState.set('server', server)
        if (flags.get('installed') === true) return
        // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- install-once guard
        flags.set('installed', true)
        host.on('SIGINT', onSignal('SIGINT'))
        host.on('SIGTERM', onSignal('SIGTERM'))
      }),
  }
}

const defaultController = createShutdownController()

/**
 * Install SIGINT/SIGTERM handlers that stop `server` and exit the process.
 *
 * Call once per boot from the real entry point. Later calls only swap the
 * server that gets stopped (see {@link createShutdownController}).
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const server = yield* startServer(appConfig, options)
 *   yield* installShutdownHandlers(server)
 *   return server
 * })
 * ```
 */
export const installShutdownHandlers = (server: ServerInstance): Effect.Effect<void> =>
  defaultController.install(server)
