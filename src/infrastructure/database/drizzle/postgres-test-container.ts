/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Test support: start the PostgreSQL testcontainer the `dockerReachable`-gated
 * unit suites share, surviving one transient Docker API connection reset.
 *
 * Imported ONLY by co-located `*.test.ts` files — never by production code
 * (`@testcontainers/postgresql` is a devDependency, loaded lazily here).
 *
 * ## Why a retry, and why such a narrow one
 *
 * Every test file runs in ONE `bun test` process, so they all share
 * testcontainers' cached Docker client and its pooled keep-alive sockets. On
 * the CI runner those sockets go through the docker-socket-proxy (HAProxy),
 * which closes a keep-alive connection that has been idle for its keep-alive
 * timeout. When one PG suite's `afterAll` stops its container and the next PG
 * suite's `beforeAll` issues its first API call right at that boundary, the
 * client reuses a socket the proxy is closing and the request dies with
 * `socket hang up` (`ECONNRESET`) in a few milliseconds — [internal ref] run 6937,
 * where the gap between the two Docker calls was ~10.2s. A fresh attempt opens
 * a fresh socket.
 *
 * Only connection-level codes are retried, a bounded number of times. A real
 * failure — an image that will not pull, a wait strategy that times out, a
 * proxy that refuses the connection outright — is thrown on the first attempt,
 * and the last transient error is rethrown unchanged once the attempts run out.
 *
 * A reset that lands AFTER the container was created can leave that container
 * behind; Ryuk is disabled on the runner, whose label-based reaper sweeps it.
 */

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'

/** The image every PG-container suite runs: `0000` creates a `vector(1536)` column. */
const POSTGRES_TEST_IMAGE = 'pgvector/pgvector:pg16'

/** Socket-level failure codes that mean "this connection died", not "this request is wrong". */
const TRANSIENT_CODES: ReadonlySet<string> = new Set(['ECONNRESET', 'EPIPE'])

/** How deep to follow a `cause` chain before giving up — guards a cyclic cause. */
const MAX_CAUSE_DEPTH = 5

const readString = (value: unknown, key: string): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' ? field : undefined
}

/**
 * True when `error` (or something in its `cause` chain) is a connection-level
 * reset: `ECONNRESET`, `EPIPE`, or Node's `socket hang up`.
 */
export const isTransientConnectionError = (error: unknown, depth = 0): boolean => {
  if (error === null || error === undefined || depth > MAX_CAUSE_DEPTH) return false
  const code = readString(error, 'code')
  if (code !== undefined && TRANSIENT_CODES.has(code)) return true
  if (readString(error, 'message')?.toLowerCase().includes('socket hang up')) return true
  const cause = typeof error === 'object' ? (error as { cause?: unknown }).cause : undefined
  return isTransientConnectionError(cause, depth + 1)
}

export interface RetryOptions {
  /** Total attempts, the first included. Default 3. */
  readonly attempts?: number
  /** Delay before the second attempt; doubled before each later one. Default 500 ms. */
  readonly backoffMs?: number
  /** Injectable for tests. Defaults to `Bun.sleep`. */
  readonly sleep?: (ms: number) => Promise<void>
  /** Called before each retry. Defaults to a line on stderr naming the error. */
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const describeError = (error: unknown): string =>
  `${readString(error, 'code') ?? 'no code'}: ${readString(error, 'message') ?? String(error)}`

const logRetry = (error: unknown, attempt: number, delayMs: number): void => {
  process.stderr.write(
    `[postgres-test-container] attempt ${attempt} hit a transient Docker connection error (${describeError(error)}); retrying in ${delayMs}ms\n`
  )
}

/**
 * Run `start`, retrying ONLY on {@link isTransientConnectionError}, at most
 * `attempts` times in total. Any other error, and the transient error of the
 * final attempt, is rethrown as-is.
 */
export const retryOnTransientConnectionError = async <A>(
  start: () => Promise<A>,
  options: RetryOptions = {}
): Promise<A> => {
  const attempts = options.attempts ?? 3
  const backoffMs = options.backoffMs ?? 500
  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms))
  const onRetry = options.onRetry ?? logRetry

  const run = async (attempt: number): Promise<A> => {
    try {
      return await start()
    } catch (error) {
      if (attempt >= attempts || !isTransientConnectionError(error)) throw error
      const delayMs = backoffMs * 2 ** (attempt - 1)
      onRetry(error, attempt, delayMs)
      await sleep(delayMs)
      return run(attempt + 1)
    }
  }

  return run(1)
}

/**
 * Start the shared PostgreSQL testcontainer, retrying a transient Docker API
 * connection reset. Use it from every PG-container `beforeAll`.
 */
export const startPostgresTestContainer = (
  options?: RetryOptions
): Promise<StartedPostgreSqlContainer> =>
  retryOnTransientConnectionError(async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
    return new PostgreSqlContainer(POSTGRES_TEST_IMAGE).start()
  }, options)
