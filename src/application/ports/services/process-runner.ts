/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * A child process that could not be run to completion: it could not be
 * started, or it outlived its time limit and was killed. A process that RAN
 * and exited non-zero is not this error — it is a {@link ProcessRunResult}
 * whose `exitCode` the caller judges, because only the caller knows which
 * exit statuses mean what.
 */
export class ProcessRunError extends Data.TaggedError('ProcessRunError')<{
  /** The command line, as an operator reads it: `systemctl restart sovrium-app@crm.service`. */
  readonly command: string
  readonly reason: 'spawn-failed' | 'timed-out'
  readonly message: string
  readonly cause?: unknown
}> {}

/** How a child process ended. */
export interface ProcessRunResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  /** True when either stream exceeded `maxOutputBytes` and was cut there. */
  readonly truncated: boolean
}

export interface ProcessRunOptions {
  /**
   * How long the child may run. At the limit it is sent SIGTERM, then SIGKILL
   * two seconds later if it is still alive, and the run fails `timed-out`.
   */
  readonly timeoutMs: number
  /** The most bytes kept of each of stdout and stderr; the rest is read and discarded. */
  readonly maxOutputBytes: number
  /** Bytes written to the child's stdin; none when absent. */
  readonly stdin?: Uint8Array
  /** The child's whole environment; the parent's when absent. */
  readonly env?: Readonly<Record<string, string>>
}

/**
 * ProcessRunner — run an executable with arguments (never a shell), bounded in
 * time and in output. Interrupting the run kills the child.
 */
export class ProcessRunner extends Context.Service<
  ProcessRunner,
  {
    readonly run: (
      argv: readonly [string, ...string[]],
      options: ProcessRunOptions
    ) => Effect.Effect<ProcessRunResult, ProcessRunError>
  }
>()('ProcessRunner') {}
