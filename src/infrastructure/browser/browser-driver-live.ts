/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Fiber, Layer, Semaphore } from 'effect'
import {
  BrowserDriver,
  BrowserFailure,
  type BrowserSession,
  type BrowserSessionOptions,
} from '@/application/ports/services/browser-driver'
import {
  DEFAULT_BROWSER_ARTIFACT_RETENTION_DAYS,
  DEFAULT_BROWSER_HOLD_MAX_MS,
  DEFAULT_BROWSER_RUN_TIMEOUT_MS,
  DEFAULT_BROWSER_STEP_TIMEOUT_MS,
  parseBrowserEnv,
  type BrowserConfig,
} from '@/domain/models/process-env/browser'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import {
  backendSource,
  chromeSandboxOff,
  holdProcessChrome,
  markProcessChromeStarted,
} from '@/infrastructure/export/webview-lifecycle'
import { logError } from '@/infrastructure/logging/logger'
import { openFailure, sessionOf } from './browser-session'
import { launchFailure, openChromeSession, openWebkitSession } from './browser-session-open'
import { agentBackendRefusal, resolveBrowserTarget, type BrowserTarget } from './browser-target'
import type { PageState } from './browser-page-state'
import type { Scope } from 'effect'

/**
 * The `BrowserDriver` live layer: reads `BROWSER_*` once, and owns
 * the sessions' lifetime (E3).
 *
 * Building it starts nothing — an operator who never runs a browser step pays
 * nothing. The first session starts (or connects to) the process's
 * Chrome, the SAME Chrome the document renderer uses: Bun runs one per process,
 * so the layer holds it like the renderer does and the last holder's release
 * closes it.
 *
 * Sessions take turns behind one set of `BROWSER_CONCURRENCY` permits per
 * process (one on Chrome, whose views share a cookie jar). A session handed to
 * `hold` keeps its permit while a person decides: the next run waits, which is
 * what keeps the filled form on screen untouched. Every held session is closed
 * when the layer is released.
 */

/** The process's session permits. Mutable on purpose: one semaphore per process. */
const processPermits: { semaphore?: Semaphore.Semaphore; count?: number } = {}

const permitsFor = (count: number): Semaphore.Semaphore => {
  if (processPermits.semaphore !== undefined && processPermits.count === count) {
    return processPermits.semaphore
  }
  const semaphore = Semaphore.makeUnsafe(count)
  processPermits.semaphore = semaphore
  processPermits.count = count
  return semaphore
}

/** A held session and the timer that ends its hold. */
interface Held {
  readonly session: BrowserSession
  readonly timer: Fiber.Fiber<void>
}

/** How long finding a remote browser's address may take. */
const CONNECT_TIMEOUT_MS = 15_000

/** Open the page state on the resolved target. */
const openState = (
  target: Exclude<BrowserTarget, { readonly kind: 'none' }>,
  config: BrowserConfig,
  options: BrowserSessionOptions
): Promise<PageState> => {
  if (target.kind === 'webkit') {
    return openWebkitSession({
      allowedHosts: options.allowedHosts,
      sessionName: options.sessionName,
      dataDir: parseDataDir(),
    })
  }
  const source = backendSource(target, CONNECT_TIMEOUT_MS, {
    sandboxOff: chromeSandboxOff(config.noSandbox === true),
    prefix: 'BROWSER',
  })
  return source.acquire().then((backend) =>
    openChromeSession({
      backend,
      allowedHosts: options.allowedHosts,
      cookies: options.cookies,
      sendGate: options.sendGate,
      onFirstView: markProcessChromeStarted,
    }).catch((error: unknown) => {
      source.invalidate()
      throw launchFailure(error)
    })
  )
}

/** The operator's limits, the defaults applied when the env could not be read. */
const limitsOf = (config: BrowserConfig | undefined): BrowserDriver['Service']['limits'] => ({
  stepTimeoutMs: config?.stepTimeoutMs ?? DEFAULT_BROWSER_STEP_TIMEOUT_MS,
  runTimeoutMs: config?.runTimeoutMs ?? DEFAULT_BROWSER_RUN_TIMEOUT_MS,
  holdMaxMs: config?.holdMaxMs ?? DEFAULT_BROWSER_HOLD_MAX_MS,
  artifactRetentionDays: config?.artifactRetentionDays ?? DEFAULT_BROWSER_ARTIFACT_RETENTION_DAYS,
})

/** Open sessions on `target`, one permit each. */
const sessionOpener =
  (target: BrowserTarget, config: BrowserConfig | undefined, permits: Semaphore.Semaphore) =>
  (options: BrowserSessionOptions): Effect.Effect<BrowserSession, BrowserFailure> => {
    if (target.kind === 'none' || config === undefined) {
      const message = target.kind === 'none' ? target.reason : 'browser_unavailable'
      return Effect.fail(new BrowserFailure({ code: 'browser_unavailable', message }))
    }
    const backendRefusal = options.sendGate === undefined ? undefined : agentBackendRefusal(target)
    if (backendRefusal !== undefined) {
      return Effect.fail(
        new BrowserFailure({ code: 'browser_backend_refused', message: backendRefusal })
      )
    }
    return Effect.gen(function* () {
      yield* permits.take(1)
      const release = permits.release(1).pipe(Effect.asVoid)
      const state = yield* Effect.tryPromise({
        try: () => openState(target, config, options),
        catch: openFailure,
      }).pipe(Effect.tapError(() => release))
      return sessionOf(state, release)
    }).pipe(Effect.withSpan('browser.open-session'))
  }

/** The held sessions of one driver, each with the timer that ends its hold. */
const holdRegistry = (scope: Scope.Scope, holds: Map<string, Held>) => {
  const takeHeld = (runId: string) =>
    Effect.gen(function* () {
      const held = holds.get(runId)
      if (held === undefined) return undefined
      holds.delete(runId)
      yield* Fiber.interrupt(held.timer)
      return held.session
    })
  const hold: BrowserDriver['Service']['hold'] = ({ runId, session, holdMs, onExpire }) =>
    Effect.gen(function* () {
      const services = yield* Effect.context<Effect.Services<typeof onExpire>>()
      const expire = Effect.gen(function* () {
        yield* Effect.sleep(holdMs)
        if (holds.get(runId)?.session !== session) return
        holds.delete(runId)
        yield* session.close
        yield* onExpire.pipe(
          Effect.provide(services),
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError('[browser] an abandoned confirmation was not recorded', cause)
            )
          ),
          // effect-swallow: logged above; the browser is closed either way, and the run is left for the stuck-run sweep.
          Effect.ignoreCause
        )
      })
      const timer = yield* Effect.forkIn(expire, scope)
      holds.set(runId, { session, timer })
    })
  const releaseHeld = (runId: string) =>
    Effect.gen(function* () {
      const session = yield* takeHeld(runId)
      if (session === undefined) return false
      yield* session.close
      return true
    })
  return { hold, takeHeld, releaseHeld }
}

/** The target an env snapshot names, with its parsed config. */
const targetOf = (env: Readonly<Record<string, string | undefined>>) => {
  const parsed = parseBrowserEnv(env)
  if (!parsed.ok) {
    return {
      config: undefined,
      target: { kind: 'none', reason: `browser_unavailable: ${parsed.error}` } as const,
    }
  }
  return { config: parsed.config, target: resolveBrowserTarget(parsed.config) }
}

/** The service for one env snapshot. */
const makeBrowserDriver = (
  env: Readonly<Record<string, string | undefined>>
): Effect.Effect<BrowserDriver['Service'], never, Scope.Scope> =>
  Effect.gen(function* () {
    const { config, target } = targetOf(env)
    if (target.kind === 'spawn' || target.kind === 'connect') yield* holdProcessChrome
    const holds = new Map<string, Held>()
    yield* Effect.addFinalizer(() =>
      Effect.forEach([...holds.values()], (held) => held.session.close, { discard: true })
    )
    return {
      limits: limitsOf(config),
      open: sessionOpener(target, config, permitsFor(config?.concurrency ?? 1)),
      ...holdRegistry(yield* Effect.scope, holds),
    }
  })

/** The live layer, reading `process.env` once when built. */
export const BrowserDriverLive = Layer.effect(BrowserDriver, makeBrowserDriver(process.env))
