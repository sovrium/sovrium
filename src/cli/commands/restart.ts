/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { isProcessRunning, readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

/**
 * Handle the 'restart' command -- stop current server, start new one in background
 */
// eslint-disable-next-line max-statements, complexity
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
      Effect.runSync(Console.log('Server restarted successfully'))
      return
    }
    // eslint-disable-next-line functional/no-expression-statements
    attempts++
  }

  Effect.runSync(Console.error('Error: Timed out waiting for new server to start'))
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}
