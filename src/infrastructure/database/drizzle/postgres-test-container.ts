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
 *
 * ## Finding Docker, and saying so when it is not there
 *
 * {@link postgresContainerGate} decides whether a PG-container suite runs. It
 * used to be `existsSync('/var/run/docker.sock') || DOCKER_HOST`, copied into
 * every suite, which skipped SILENTLY on colima (whose socket lives under
 * `~/.colima/<profile>/`): a skip reads like a pass in the reporter. The order
 * is now, first match wins:
 *
 * 1. `DOCKER_HOST`, honoured verbatim and never probed. This is the CI path:
 *    the runner sets `DOCKER_HOST=tcp://…:2375` to reach the docker-socket-proxy,
 *    and the workflow sets the `TESTCONTAINERS_*` overrides beside it.
 * 2. `/var/run/docker.sock` — Linux, and Docker Desktop's symlink.
 * 3. `~/.colima/<profile>/docker.sock`, `default` first, then the other
 *    profiles alphabetically (Colima's own `_`-prefixed directories skipped).
 * 4. `~/.docker/run/docker.sock` — Docker Desktop without the `/var/run` link.
 *
 * A socket found at 3 or 4 is exported as `DOCKER_HOST` so testcontainers,
 * which only knows 1 and 2, connects to it; `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`
 * is set to the in-VM `/var/run/docker.sock` (unless already set) because the
 * Ryuk reaper mounts that path inside the VM, not the host path. Every skip
 * prints one line on stderr naming the reason and, when Docker was looked for,
 * every path tried.
 */

import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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

/** The filesystem and environment {@link resolveDockerHost} reads — injectable for tests. */
export interface DockerProbe {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly home: string
  /** True when `path` exists and is a unix socket (following symlinks). */
  readonly isSocket: (path: string) => boolean
  /** The entry names of `path`, or `[]` when it cannot be read. */
  readonly listDir: (path: string) => readonly string[]
}

export type DockerHostResolution =
  | {
      readonly kind: 'env'
      /** `DOCKER_HOST` exactly as the environment gave it. */
      readonly dockerHost: string
    }
  | {
      readonly kind: 'socket'
      /** `unix://<socketPath>`, ready to export as `DOCKER_HOST`. */
      readonly dockerHost: string
      readonly socketPath: string
      /** Whether testcontainers would have found this socket on its own. */
      readonly standard: boolean
      readonly tried: readonly string[]
    }
  | { readonly kind: 'missing'; readonly tried: readonly string[] }

const STANDARD_SOCKET = '/var/run/docker.sock'

const isSocketOnDisk = (path: string): boolean => {
  try {
    return statSync(path).isSocket()
  } catch {
    return false
  }
}

const listDirOnDisk = (path: string): readonly string[] => {
  try {
    return readdirSync(path)
  } catch {
    return []
  }
}

/** The real filesystem and `process.env`. */
export const liveDockerProbe = (): DockerProbe => ({
  env: process.env,
  home: process.env['HOME'] ?? homedir(),
  isSocket: isSocketOnDisk,
  listDir: listDirOnDisk,
})

/** Colima profile directories, `default` first, then alphabetical; Colima's `_*` internals excluded. */
const colimaProfiles = (probe: DockerProbe): readonly string[] => {
  const names = probe
    .listDir(join(probe.home, '.colima'))
    .filter((name) => !name.startsWith('_') && !name.includes('.'))
  const rest = names.filter((name) => name !== 'default').toSorted()
  return names.includes('default') ? ['default', ...rest] : rest
}

/** The candidate sockets after `DOCKER_HOST`, in resolution order. */
export const dockerSocketCandidates = (probe: DockerProbe): readonly string[] => [
  STANDARD_SOCKET,
  ...colimaProfiles(probe).map((profile) => join(probe.home, '.colima', profile, 'docker.sock')),
  join(probe.home, '.docker', 'run', 'docker.sock'),
]

/**
 * Where testcontainers should reach Docker: `DOCKER_HOST` first, then the
 * sockets of {@link dockerSocketCandidates} in order. Pure over `probe`.
 */
export const resolveDockerHost = (probe: DockerProbe): DockerHostResolution => {
  const fromEnv = probe.env['DOCKER_HOST']
  if (fromEnv !== undefined && fromEnv.trim() !== '') return { kind: 'env', dockerHost: fromEnv }
  const candidates = dockerSocketCandidates(probe)
  const index = candidates.findIndex((candidate) => probe.isSocket(candidate))
  if (index === -1) return { kind: 'missing', tried: candidates }
  const socketPath = candidates[index] as string
  return {
    kind: 'socket',
    dockerHost: `unix://${socketPath}`,
    socketPath,
    standard: socketPath === STANDARD_SOCKET,
    tried: candidates.slice(0, index + 1),
  }
}

export interface GateOptions {
  readonly probe?: DockerProbe
  /** Where the gate writes `DOCKER_HOST` and the socket override. Defaults to `process.env`. */
  readonly targetEnv?: Record<string, string | undefined>
  /** One line per decision. Defaults to stderr. */
  readonly log?: (line: string) => void
}

const logLine = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

/**
 * Whether a PG-container suite named `suite` runs. `optIn` is the suite's own
 * read of the lane variable — it stays in each test file because
 * `[internal ref]` pins a file to the PostgreSQL shard by finding
 * that variable's name in its CONTENT.
 *
 * Returns `false` (and logs why) when the suite is not opted in or no Docker
 * endpoint resolves; on a non-standard socket it exports `DOCKER_HOST` (and the
 * Ryuk socket override) so testcontainers connects to what was found.
 */
export const postgresContainerGate = (
  suite: string,
  optIn: boolean,
  options: GateOptions = {}
): boolean => {
  const log = options.log ?? logLine
  const prefix = `[postgres-test-container] ${suite}:`
  if (!optIn) {
    log(`${prefix} SKIPPED — the PostgreSQL lane is opt-in; set RUN_PG_MIGRATION_TESTS=1 to run it`)
    return false
  }
  const resolution = resolveDockerHost(options.probe ?? liveDockerProbe())
  if (resolution.kind === 'missing') {
    log(
      `${prefix} SKIPPED — no Docker endpoint: DOCKER_HOST is unset and no socket exists at ${resolution.tried.join(', ')}. Start Docker/colima or export DOCKER_HOST.`
    )
    return false
  }
  if (resolution.kind === 'socket' && !resolution.standard) {
    const target = options.targetEnv ?? process.env
    target['DOCKER_HOST'] = resolution.dockerHost
    target['TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE'] ??= STANDARD_SOCKET
    log(`${prefix} using ${resolution.dockerHost} (exported as DOCKER_HOST)`)
  }
  return true
}
