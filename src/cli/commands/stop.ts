/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

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

  // Wait briefly for process to exit, then clean up lock file
  // eslint-disable-next-line functional/no-expression-statements
  await new Promise((r) => setTimeout(r, 500))
  // eslint-disable-next-line functional/no-expression-statements
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
