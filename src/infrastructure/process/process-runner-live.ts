/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  ProcessRunError,
  ProcessRunner,
  type ProcessRunOptions,
  type ProcessRunResult,
} from '@/application/ports/services/process-runner'

/**
 * `ProcessRunner` over `Bun.spawn`.
 *
 * The child is acquired with `Effect.acquireRelease`, whose release kills it
 * (SIGKILL) if it is still running — so an interrupted run, a per-action
 * timeout firing, or a failure anywhere after the spawn never leaves an orphan.
 * Its own time limit sends SIGTERM first and SIGKILL {@link KILL_GRACE_MS}
 * later, which gives `systemctl` a chance to release the job it holds.
 *
 * On POSIX the child leads its own process group, and both signals go to the
 * whole group. A shell that does not `exec` its last command (dash, which is
 * `/bin/sh` on Debian and Ubuntu) leaves that command as a grandchild holding
 * the output pipes; signalling the shell alone would stop it while the
 * grandchild kept the run open until it finished on its own.
 *
 * Each output stream is read to its end (a child blocked on a full pipe would
 * never exit) but only its first `maxOutputBytes` are kept.
 */

/** How long a child has between SIGTERM and SIGKILL once its time is up. */
export const KILL_GRACE_MS = 2000

type Child = Bun.Subprocess<'pipe' | 'ignore', 'pipe', 'pipe'>

/** Read a stream to its end, keeping at most `limit` bytes. */
const readCapped = async (
  stream: ReadableStream<Uint8Array>,
  limit: number
): Promise<{ readonly text: string; readonly truncated: boolean }> => {
  let kept: readonly Uint8Array[] = []
  let size = 0
  let truncated = false
  for await (const chunk of stream) {
    const room = limit - size
    if (room <= 0) {
      truncated = truncated || chunk.byteLength > 0
      continue
    }
    const part = chunk.byteLength > room ? chunk.subarray(0, room) : chunk
    truncated = truncated || part.byteLength < chunk.byteLength
    kept = [...kept, part]
    size += part.byteLength
  }
  return { text: Buffer.concat(kept).toString('utf8'), truncated }
}

/** Process groups are a POSIX notion; on Windows the child is signalled alone. */
const OWN_GROUP = process.platform !== 'win32'

const spawn = (argv: readonly [string, ...string[]], options: ProcessRunOptions): Child =>
  Bun.spawn([...argv], {
    stdin: options.stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    detached: OWN_GROUP,
    ...(options.env === undefined ? {} : { env: { ...options.env } }),
  }) as Child

/**
 * Signal the child's whole process group, so a grandchild it left running is
 * stopped with it. Only called while the group still has a member (the child
 * itself, or whatever holds its pipes), so its id cannot have been reused.
 * Falls back to the child alone where there is no group, or once it is gone.
 */
const killGroup = (child: Child, signal: NodeJS.Signals): void => {
  if (OWN_GROUP) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // ESRCH: the group is already empty. The child-only kill below is a no-op then.
    }
  }
  child.kill(signal)
}

/** Wait for the child, enforcing the time limit; resolves `undefined` when it was killed for time. */
const awaitChild = async (
  child: Child,
  options: ProcessRunOptions
): Promise<ProcessRunResult | undefined> => {
  let timedOut = false
  let killTimer: ReturnType<typeof setTimeout> | undefined
  const timer = setTimeout(() => {
    timedOut = true
    killGroup(child, 'SIGTERM')
    killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), KILL_GRACE_MS)
  }, options.timeoutMs)
  try {
    if (options.stdin !== undefined && child.stdin !== undefined && child.stdin !== null) {
      const sink = child.stdin as Bun.FileSink
      sink.write(options.stdin)
      await sink.end()
    }
    const [stdout, stderr, exitCode] = await Promise.all([
      readCapped(child.stdout, options.maxOutputBytes),
      readCapped(child.stderr, options.maxOutputBytes),
      child.exited,
    ])
    if (timedOut) return undefined
    return {
      exitCode,
      stdout: stdout.text,
      stderr: stderr.text,
      truncated: stdout.truncated || stderr.truncated,
    }
  } finally {
    clearTimeout(timer)
    if (killTimer !== undefined) clearTimeout(killTimer)
  }
}

const run = (
  argv: readonly [string, ...string[]],
  options: ProcessRunOptions
): Effect.Effect<ProcessRunResult, ProcessRunError> => {
  const command = argv.join(' ')
  return Effect.acquireRelease(
    Effect.try({
      try: () => spawn(argv, options),
      catch: (cause) =>
        new ProcessRunError({
          command,
          reason: 'spawn-failed',
          message: `could not start ${argv[0]}: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        }),
    }),
    (child) =>
      Effect.sync(() => {
        if (child.exitCode === null && child.signalCode === null) killGroup(child, 'SIGKILL')
      })
  ).pipe(
    Effect.flatMap((child) =>
      Effect.tryPromise({
        try: () => awaitChild(child, options),
        catch: (cause) =>
          new ProcessRunError({
            command,
            reason: 'spawn-failed',
            message: `${command} could not be read to completion: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          }),
      })
    ),
    Effect.filterOrFail(
      (result): result is ProcessRunResult => result !== undefined,
      () =>
        new ProcessRunError({
          command,
          reason: 'timed-out',
          message: `${command} did not finish within ${String(options.timeoutMs)} ms and was stopped`,
        })
    ),
    Effect.scoped,
    Effect.withSpan('process.run', { attributes: { 'process.executable': argv[0] } })
  )
}

export const ProcessRunnerLive = Layer.succeed(ProcessRunner, { run })
