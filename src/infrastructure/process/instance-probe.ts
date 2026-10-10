/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Effect } from 'effect'
import {
  type InstanceProbeResult,
  type InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { fail, instanceDir, readStatusFile } from './instance-releases'

/**
 * The health probe of a supervised app: `GET /api/health` on the loopback port
 * its last release recorded, asked again until the app answers.
 */

/** One attempt at the loopback health endpoint, without its timing. */
type ProbeAnswer = Omit<InstanceProbeResult, 'latencyMs'>

/** Pause between two attempts of a probe whose app has not answered yet. */
const PROBE_RETRY_INTERVAL_MS = 250

/** One probe of the loopback health endpoint. Total: an app that does not answer is `ok: false`. */
const probePort = async (port: number, timeoutMs: number): Promise<ProbeAnswer> => {
  try {
    const response = await withFetchTimeout(
      `http://127.0.0.1:${String(port)}/api/health`,
      { method: 'GET' },
      timeoutMs
    )
    await response.body?.cancel().catch(() => undefined)
    return { ok: response.ok, status: response.status }
  } catch {
    return { ok: false }
  }
}

/**
 * Ask `port` again, every `PROBE_RETRY_INTERVAL_MS`, until it answers with a
 * success or `timeoutMs` runs out: an app restarted onto a release refuses
 * connections, or answers 503, until it is ready. The last answer is the
 * result, and `latencyMs` is the whole wait, from the first attempt.
 */
const pollHealth = (port: number, timeoutMs: number): Effect.Effect<InstanceProbeResult> =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis
    const elapsed = Clock.currentTimeMillis.pipe(Effect.map((now) => now - started))
    const attempt = (): Effect.Effect<ProbeAnswer> =>
      Effect.gen(function* () {
        const budget = Math.max(timeoutMs - (yield* elapsed), 1)
        // effect-promise: total -- probePort catches every rejection and answers ok: false.
        const answer = yield* Effect.promise(() => probePort(port, budget))
        if (answer.ok || timeoutMs - (yield* elapsed) <= PROBE_RETRY_INTERVAL_MS) return answer
        yield* Effect.sleep(PROBE_RETRY_INTERVAL_MS)
        return yield* attempt()
      })
    const answer = yield* attempt()
    return { ...answer, latencyMs: Math.round(yield* elapsed) }
  })

/**
 * `GET http://127.0.0.1:<port>/api/health` on the port the last apply
 * recorded, asked again until the app answers or `timeoutMs` runs out. The
 * address is fixed to loopback and built here, never from a caller's URL, so it
 * does not go through the outbound URL checks. It never goes through the app's
 * socket, so it never wakes a suspended app.
 */
export const probeInstance = (
  slug: string,
  timeoutMs: number
): Effect.Effect<InstanceProbeResult, InstanceSupervisorError> =>
  Effect.gen(function* () {
    const dir = yield* instanceDir(slug)
    const recorded = yield* readStatusFile(dir)
    if (recorded?.port === undefined) {
      return yield* fail(
        `${slug} has no recorded port; apply a release whose env sets PORT before probing it`
      )
    }
    return yield* pollHealth(recorded.port, timeoutMs)
  }).pipe(Effect.withSpan('instance.probe'))
