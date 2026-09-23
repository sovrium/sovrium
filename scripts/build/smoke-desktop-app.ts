#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Run a BUILT desktop bundle once, headless, and decide whether it works.
 *
 * # What this proves that nothing else does
 *
 * `desktop:check` compiles the crate. `cargo test` exercises its pure logic.
 * Neither runs the artefact a user downloads, and the defects that only exist in
 * that artefact are the expensive ones:
 *
 * - the sidecar is not where `current_exe()`-relative resolution looks for it,
 *   so the app opens and does nothing;
 * - the sidecar is there but cannot execute — on macOS an unsigned or
 *   wrongly-entitled nested Mach-O is killed by the kernel at launch, with no
 *   message, so again the app opens and does nothing;
 * - the bundle is fine but the engine inside it cannot serve, which is the
 *   class `.github/workflows/release.yml` already smoke-tests for the bare
 *   binaries and had no equivalent for the installers.
 *
 * So the test is: point the bundle at an empty folder, and see whether a real
 * Sovrium instance ends up answering HTTP.
 *
 * # Two verdicts, deliberately independent
 *
 * The shell's own `SOVRIUM_DESKTOP_SMOKE` mode (desktop/src-tauri/src/smoke.rs)
 * scaffolds the project, starts the engine, waits for its own health probe to
 * pass, writes `smoke-report.json` — and then HOLDS, waiting for a `quit`
 * sentinel this script writes.
 *
 * The hold is what makes the two verdicts independent. While the shell waits,
 * this script reads the engine's OWN lock file and makes its OWN HTTP request,
 * on both loopback families. If the shell's probe were the only evidence, the
 * test would be the shell marking its own homework.
 *
 * Stopping is a file rather than a signal because Windows has no SIGTERM, and
 * one mechanism on three operating systems beats the tidiest one on two.
 *
 * # Isolation
 *
 * Every OS-level location the shell writes to is redirected into the run
 * directory before launch: `HOME`, the XDG dirs, `APPDATA`, `LOCALAPPDATA`. A
 * smoke test that wrote into the developer's real settings store would be a
 * worse bug than the one it is looking for.
 *
 * Usage:
 *   bun run scripts/build/smoke-desktop-app.ts --exe "dist/Sovrium.app/Contents/MacOS/Sovrium"
 *   bun run scripts/build/smoke-desktop-app.ts --exe ./Sovrium.exe --run-dir /tmp/smoke
 *   bun run scripts/build/smoke-desktop-app.ts --exe ./sovrium-desktop --template crm
 *
 * Exit codes: 0 the bundle served, 1 it did not (with the reason on stderr).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** The smallest bundled template that still boots a real server. */
const DEFAULT_TEMPLATE = 'hello-world'

/** How long the bundle gets to go from launch to a healthy engine. */
const DEFAULT_READY_TIMEOUT_MS = 180_000

/** How long the engine gets to write its lock file once the shell reports healthy. */
const DEFAULT_LOCK_TIMEOUT_MS = 30_000

/** How long the process gets to exit after the quit sentinel appears. */
const DEFAULT_EXIT_TIMEOUT_MS = 30_000

/** One HTTP attempt's budget. Loopback; anything slower is a hang, not latency. */
const HEALTH_TIMEOUT_MS = 5000

const POLL_MS = 250

/** Options this script understands. */
export interface SmokeOptions {
  readonly exe: string
  readonly runDir: string
  readonly template: string
  readonly readyTimeoutMs: number
  readonly lockTimeoutMs: number
  readonly exitTimeoutMs: number
}

const flag = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const budget = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Parse the command line.
 *
 * `--exe` is required and is not defaulted: the whole point is to test ONE
 * named artefact, and a script that guessed which would silently test the wrong
 * one on the day a lane's output path changed.
 */
export const parseArgs = (args: readonly string[], makeRunDir: () => string): SmokeOptions => {
  const exe = flag(args, '--exe')
  if (!exe) {
    throw new Error(
      'pass --exe <path to the built executable>. It is not defaulted, because guessing ' +
        'which artefact to test is how a lane reports success against the wrong file.'
    )
  }
  const runDir = flag(args, '--run-dir')
  return {
    exe: resolve(exe),
    runDir: runDir ? resolve(runDir) : makeRunDir(),
    template: flag(args, '--template') ?? DEFAULT_TEMPLATE,
    readyTimeoutMs: budget(flag(args, '--ready-timeout-ms'), DEFAULT_READY_TIMEOUT_MS),
    lockTimeoutMs: budget(flag(args, '--lock-timeout-ms'), DEFAULT_LOCK_TIMEOUT_MS),
    exitTimeoutMs: budget(flag(args, '--exit-timeout-ms'), DEFAULT_EXIT_TIMEOUT_MS),
  }
}

/** The shell's verdict, as `smoke.rs` writes it. */
export interface SmokeReport {
  readonly ok: boolean
  readonly port: number
  readonly origin: string
  readonly elapsedMs: number
  readonly failure?: string
  readonly tail?: readonly string[]
}

/**
 * The port out of the engine's lock file.
 *
 * Read rather than taken from the shell's report on purpose: this is the
 * ENGINE's own statement about what it bound, and agreeing with the shell is
 * part of what is being tested.
 */
export const portFromLock = (raw: string): number | undefined => {
  try {
    const parsed = JSON.parse(raw) as { port?: unknown }
    const port = typeof parsed.port === 'number' ? parsed.port : undefined
    return port && port > 0 ? port : undefined
  } catch {
    // A half-written lock file is ordinary — the engine writes it while this
    // script is polling. Treat it as "not yet", never as malformed.
    return undefined
  }
}

/**
 * The health URLs to try, in probe order.
 *
 * IPv6 first because that is what the engine binds on macOS: `Bun.serve` with
 * the default `localhost` hostname resolves to `::1` there, so an IPv4-only
 * probe finds nothing. Both are tried because the answer is a property of the
 * machine's resolver, not of Sovrium.
 */
export const healthUrls = (port: number): readonly string[] => [
  `http://[::1]:${port}/api/health`,
  `http://127.0.0.1:${port}/api/health`,
]

/**
 * Does something answer HTTP on this port?
 *
 * ANY status counts, not only 200 — the question is "is a server listening and
 * answering", and `/api/health` sitting ahead of the API auth guards is a fact
 * about today's routing rather than a contract. A 401 proves a server is there
 * exactly as well as a 200 does.
 */
export const answersHttp = async (port: number): Promise<string | undefined> => {
  for (const url of healthUrls(port)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
      return `${url} -> HTTP ${response.status}`
    } catch {
      // Wrong family, or nothing there. Try the other one.
    }
  }
  return undefined
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

const waitFor = async <T>(
  produce: () => T | undefined | Promise<T | undefined>,
  timeoutMs: number
): Promise<T | undefined> => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await produce()
    if (value !== undefined) return value
    if (Date.now() >= deadline) return undefined
    await sleep(POLL_MS)
  }
}

/**
 * The environment the bundle runs with.
 *
 * Exported so the isolation can be asserted in a test rather than reviewed by
 * eye — every variable below is one the shell or the engine would otherwise
 * resolve to a real user location.
 */
export const smokeEnv = (
  options: SmokeOptions,
  base: Readonly<Record<string, string | undefined>>
): Record<string, string> => {
  const home = join(options.runDir, 'home')
  return {
    ...(base as Record<string, string>),
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(home, 'config'),
    XDG_DATA_HOME: join(home, 'data'),
    XDG_CACHE_HOME: join(home, 'cache'),
    APPDATA: join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(home, 'AppData', 'Local'),
    SOVRIUM_DESKTOP_SMOKE: '1',
    SOVRIUM_DESKTOP_SMOKE_DIR: options.runDir,
    SOVRIUM_DESKTOP_SMOKE_TEMPLATE: options.template,
    SOVRIUM_DESKTOP_SMOKE_TIMEOUT_MS: String(options.readyTimeoutMs),
    // The engine is secure-by-default and refuses to boot without an encryption
    // key. The same opt-in the binary smoke tests in release.yml use.
    SOVRIUM_ALLOW_DEV_KEY: '1',
  }
}

/**
 * Report a refusal and stop.
 *
 * The type annotation is on the VARIABLE rather than only on the arrow, and
 * that is not style: TypeScript narrows control flow after a never-returning
 * call only when the callee's declaration carries an explicit type. Written as
 * `const fail = (m: string): never => …`, every `report` and `lockPort` below
 * stays `| undefined` and eleven type errors follow.
 */
const fail: (message: string) => never = (message) => {
  process.stderr.write(`smoke-desktop-app FAILED: ${message}\n`)
  process.exit(1)
}

const main = async (argv: readonly string[]): Promise<number> => {
  const options = parseArgs(argv, () => mkdtempSync(join(tmpdir(), 'sovrium-desktop-smoke-')))

  if (!existsSync(options.exe)) {
    fail(`no executable at ${options.exe}`)
  }
  mkdirSync(join(options.runDir, 'home'), { recursive: true })

  const reportPath = join(options.runDir, 'smoke-report.json')
  const quitPath = join(options.runDir, 'quit')
  const lockPath = join(options.runDir, 'project', '.sovrium', 'lock')

  process.stdout.write(`smoke-desktop-app: launching ${options.exe}\n`)
  process.stdout.write(`smoke-desktop-app: run directory ${options.runDir}\n`)

  const child = Bun.spawn([options.exe], {
    env: smokeEnv(options, process.env),
    // Inherited rather than piped: the shell's log lines and the engine's are
    // the first thing anybody reads when this goes red, and a pipe this script
    // forgot to drain would deadlock the child instead.
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'ignore',
  })

  let exitCode: number | undefined
  const exited = child.exited.then((code) => {
    exitCode = code
    return code
  })

  try {
    // 1. The shell's verdict.
    const report = await waitFor<SmokeReport>(() => {
      if (exitCode !== undefined && !existsSync(reportPath)) {
        // It died before writing anything. Stop waiting out the full budget —
        // the exit code is already the answer.
        return {
          ok: false,
          port: 0,
          origin: '',
          elapsedMs: 0,
          failure: 'the process exited before reporting',
        }
      }
      if (!existsSync(reportPath)) return undefined
      try {
        return JSON.parse(readFileSync(reportPath, 'utf8')) as SmokeReport
      } catch {
        return undefined
      }
    }, options.readyTimeoutMs + 10_000)

    if (!report) {
      fail(
        `the bundle wrote no ${reportPath} within ${options.readyTimeoutMs} ms. ` +
          'It either never reached the self-test, or the self-test never finished.'
      )
    }
    if (!report.ok) {
      const tail = report.tail?.length ? `\n  ${report.tail.join('\n  ')}` : ''
      fail(`the shell reported a failure: ${report.failure ?? 'no reason recorded'}${tail}`)
    }
    process.stdout.write(
      `smoke-desktop-app: the shell reports serving at ${report.origin} after ${report.elapsedMs} ms\n`
    )

    // 2. This script's own verdict — the engine's lock file, then real HTTP.
    const lockPort = await waitFor(
      () => (existsSync(lockPath) ? portFromLock(readFileSync(lockPath, 'utf8')) : undefined),
      options.lockTimeoutMs
    )
    if (!lockPort) {
      fail(
        `the engine wrote no usable port to ${lockPath} within ${options.lockTimeoutMs} ms — ` +
          'the shell says it is serving and the engine has not said where.'
      )
    }
    if (lockPort !== report.port) {
      fail(
        `the shell reports port ${report.port} and the engine's lock file says ${lockPort}. ` +
          'The window would be pointed at the wrong port.'
      )
    }

    const answer = await answersHttp(lockPort)
    if (!answer) {
      fail(
        `nothing answered HTTP on port ${lockPort} on either loopback family ` +
          `(${healthUrls(lockPort).join(', ')}).`
      )
    }
    process.stdout.write(`smoke-desktop-app: ${answer}\n`)

    // 3. Quit, and assert it quits cleanly.
    writeFileSync(quitPath, 'quit\n')
    const code = await Promise.race([exited, sleep(options.exitTimeoutMs).then(() => undefined)])
    if (code === undefined) {
      fail(`the bundle did not exit within ${options.exitTimeoutMs} ms of the quit sentinel.`)
    }
    if (code !== 0) {
      fail(`the bundle exited ${code}.`)
    }

    // 4. No orphan. A live engine still holding the port is the failure that
    //    matters: the next launch would collide with it, and on a CI runner it
    //    would outlive the job. Scoped by PORT rather than by process name —
    //    this machine may be running other Sovrium instances that are none of
    //    this test's business.
    const stillAnswering = await answersHttp(lockPort)
    if (stillAnswering) {
      fail(`the engine outlived the shell — ${stillAnswering} after exit.`)
    }
    if (existsSync(lockPath)) {
      // Loud, but not fatal. A stale lock blocks the next `sovrium start` and is
      // worth seeing; it is reported rather than gated because the shutdown path
      // that writes it differs per OS (SIGTERM on Unix, stdin-close on Windows)
      // and a red here would be a verdict on a path this script cannot yet
      // distinguish from a slow unlink.
      process.stdout.write(
        `smoke-desktop-app: WARNING — ${lockPath} survived a clean exit. ` +
          'The port is free, so this is not an orphan, but the lock was not unlinked.\n'
      )
    }

    process.stdout.write(
      `smoke-desktop-app: OK — ${options.template} served on port ${lockPort} and stopped cleanly\n`
    )
    return 0
  } finally {
    // Never a pattern kill: this is the child this script spawned, by handle.
    if (exitCode === undefined) {
      child.kill()
    }
  }
}

if (import.meta.main) {
  process.exit(await main(Bun.argv.slice(2)))
}
