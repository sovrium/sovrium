/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import { isProcessRunning, readLockFile } from '@/infrastructure/server/lock-file'
import { readStatusDocument } from '@/infrastructure/server/status-file'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'
import type { ServerStatusDocument } from '@/infrastructure/server/status-file'

/**
 * `sovrium reload` — ask the running server to apply its config file, and
 * report what the SERVER did.
 *
 * The command decides nothing. It signals the process (SIGUSR1), and the
 * server runs the reload `--watch` runs on a save: load and decode the config
 * graph, swap a render-only change into the live listener, restart in place on
 * the same port for a change to a restart-class key, or refuse and keep
 * serving. That path publishes its verdict in `status.json`, and the command
 * waits for it — so what it prints is what happened, never what it asked for.
 *
 * `--message` is accepted and does nothing: there is no version ledger for a
 * note to be recorded in.
 */

/** How long the command waits for the server's verdict. */
const VERDICT_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 100

const GUIDANCE = 'Run `sovrium validate <config>` to check it without touching the running server.'

/**
 * The record this reload published: written by the same process, after the
 * one read before the signal, and carrying a verdict that record did not. A
 * restart-class reload also publishes its new server's boot, which carries the
 * previous verdict — waiting for a NEW `lastReload` skips it.
 */
const isVerdictOf = (
  pid: number,
  before: ServerStatusDocument | undefined,
  candidate: ServerStatusDocument | undefined
): candidate is ServerStatusDocument =>
  candidate !== undefined &&
  candidate.pid === pid &&
  candidate.lastReload !== undefined &&
  candidate.seq > (before?.pid === pid ? before.seq : 0) &&
  candidate.lastReload.at !== (before?.pid === pid ? before.lastReload?.at : undefined)

/** Wait for the verdict; `undefined` when none came or the process died first. */
const awaitVerdict = async (
  pid: number,
  before: ServerStatusDocument | undefined,
  deadline: number
): Promise<ServerStatusDocument | undefined> => {
  const status = await readStatusDocument()
  if (isVerdictOf(pid, before, status)) return status
  if (Date.now() >= deadline || !isProcessRunning(pid)) return undefined
  await Bun.sleep(POLL_INTERVAL_MS)
  return awaitVerdict(pid, before, deadline)
}

const findingLines = (findings: readonly ConfigFinding[]): readonly string[] =>
  findings.map((finding) =>
    finding.path === '' ? finding.message : `${finding.path}: ${finding.message}`
  )

const seconds = (durationMs: number): string => `${(durationMs / 1000).toFixed(1)} s`

/** The line a successful reload prints. */
const successLine = (status: ServerStatusDocument): string => {
  const record = status.lastReload
  if (record?.kind !== 'restart')
    return `Configuration reloaded in place in ${String(record?.durationMs ?? 0)} ms — open connections were kept.`
  const where = status.port === undefined ? 'its socket' : `port ${String(status.port)}`
  const why = record.reason === undefined ? '' : ` (${record.reason} changed)`
  return `Configuration reloaded — the server restarted on ${where} in ${seconds(record.durationMs)}${why}; open connections were closed.`
}

/** Print the verdict, exiting 1 for anything but a reload that was applied. */
const report = (status: ServerStatusDocument): void => {
  const record = status.lastReload
  if (record?.outcome === 'success') {
    Effect.runSync(Console.log(successLine(status)))
    return
  }
  const headline =
    record?.outcome === 'kept'
      ? 'Sovrium refused this configuration — nothing was reloaded.'
      : record?.outcome === 'rolled-back'
        ? 'The new configuration did not boot, so the server went back to the previous one.'
        : 'The new configuration did not boot, and the previous one did not either: the server is down.'
  printFailure({ headline, detail: findingLines(record?.findings ?? []), guidance: GUIDANCE })
  process.exit(1)
}

/** Handle `sovrium reload`: signal the running server and print what it did. */
export const handleReloadCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    printStderr('Error: No server is running (lock file not found)')
    process.exit(1)
  }

  if (!isProcessRunning(lockData.pid)) {
    printStderr('Error: Server is not running')
    process.exit(1)
  }

  if (!lockData.configPath) {
    printStderr(
      'Error: The running server was not started from a config file, so there is nothing to reload.'
    )
    process.exit(1)
  }

  const before = await readStatusDocument()
  try {
    process.kill(lockData.pid, 'SIGUSR1')
  } catch {
    printStderr('Error: Failed to send reload signal')
    process.exit(1)
  }

  const verdict = await awaitVerdict(lockData.pid, before, Date.now() + VERDICT_TIMEOUT_MS)
  if (verdict === undefined) {
    printStderr(
      isProcessRunning(lockData.pid)
        ? `Error: The server did not confirm the reload within ${String(VERDICT_TIMEOUT_MS / 1000)} s (PID ${String(lockData.pid)}).`
        : `Error: The server stopped before it confirmed the reload (PID ${String(lockData.pid)}).`
    )
    process.exit(1)
  }
  report(verdict)
}
