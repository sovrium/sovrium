/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { readLockFile, removeLockFile, waitForProcessExit } from '@/infrastructure/server/lock-file'

/**
 * Handle the 'stop' command -- read PID from lock file and send SIGTERM
 */
export const handleStopCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    printFailure({
      headline: 'No server is running.',
      guidance: "Start one with 'sovrium start <config>'.",
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Whether the signal landed decides what we are allowed to claim afterwards.
  // `process.kill` throws ESRCH when the PID is gone, and swallowing that used
  // to print "Server stopped successfully" for a process nobody stopped — a
  // false fact, and the one defect no copy edit can catch.
  const wasRunning = ((): boolean => {
    try {
      // eslint-disable-next-line functional/no-expression-statements
      process.kill(lockData.pid, 'SIGTERM')
      return true
    } catch {
      return false
    }
  })()

  // Wait for the process to actually go away. A fixed sleep used to stand in
  // for this, which made "Server stopped." a claim about elapsed time rather
  // than about the server — and a slow shutdown printed it over a process that
  // was still serving requests.
  const exited = wasRunning ? await waitForProcessExit(lockData.pid) : true

  if (!exited) {
    // Keep the lock file: it is still TRUE. Removing it here would hide a live
    // server from `sovrium start`, which would then boot a second one beside it.
    printFailure({
      headline: `Server (PID ${lockData.pid}) did not exit within 5s after SIGTERM.`,
      guidance: `Force it with 'kill -9 ${lockData.pid}', then run 'sovrium stop' again to clear the lock.`,
    })
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Belt-and-braces: the server removes its own lock file on the way out.
  await removeLockFile()

  // No guidance line on the success path: the inverse of `stop` is `start`, and
  // an operator who just stopped a server knows it (T18).
  Effect.runSync(
    Console.log(
      wasRunning
        ? 'Server stopped.'
        : `Server was not running — removed a stale lock file for PID ${lockData.pid}.`
    )
  )
}
