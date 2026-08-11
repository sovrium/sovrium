/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { isProcessRunning, readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

/**
 * Handle the 'restart' command -- stop current server, start new one in background
 */
export const handleRestartCommand = async (configFile?: string): Promise<void> => {
  const { spawn } = await import('node:child_process')
  const lockData = await readLockFile()

  // If server is running, stop it first
  if (lockData && isProcessRunning(lockData.pid)) {
    try {
      // eslint-disable-next-line functional/no-expression-statements
      process.kill(lockData.pid, 'SIGTERM')
    } catch {
      // Process may already be dead
    }
    // Wait for old server to stop
    // eslint-disable-next-line functional/no-expression-statements
    await new Promise((r) => setTimeout(r, 500))
    // eslint-disable-next-line functional/no-expression-statements
    await removeLockFile()
  }

  // Use provided config file, or fall back to config path from lock file
  const effectiveConfigFile = configFile || lockData?.configPath

  if (!effectiveConfigFile) {
    Effect.runSync(Console.error('Error: No config file specified and none found in lock file'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Start new server as a detached background process
  const child = spawn('bun', ['run', 'src/cli/index.ts', 'start', effectiveConfigFile], {
    env: { ...process.env, PORT: '0' },
    stdio: 'ignore',
    detached: true,
  })
  child.unref()

  // Wait for the new server to create its lock file
  // eslint-disable-next-line functional/no-let
  let attempts = 0
  // eslint-disable-next-line functional/no-loop-statements
  while (attempts < 50) {
    // eslint-disable-next-line functional/no-expression-statements
    await new Promise((r) => setTimeout(r, 200))
    const newLock = await readLockFile()
    if (newLock && newLock.pid !== lockData?.pid) {
      // The spawn uses PORT=0, so the new port is knowable ONLY from the lock
      // file the restarted server just wrote. Reporting it is the whole point.
      Effect.runSync(Console.log(`Server restarted on http://localhost:${newLock.port}.`))
      return
    }
    // eslint-disable-next-line functional/no-expression-statements
    attempts++
  }

  // Naming the old server's fate is the half the operator most needs: at this
  // point it is already gone, so "timed out" alone reads as a no-op.

  printFailure({
    headline: 'The new server did not start within 10s. The old one was already stopped.',
    guidance: "Run 'sovrium start <config>' in the foreground to see why it failed.",
  })
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}
