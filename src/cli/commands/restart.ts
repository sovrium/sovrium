/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { isProcessRunning, readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

export const handleRestartCommand = async (configFile?: string): Promise<void> => {
  const { spawn } = await import('node:child_process')
  const lockData = await readLockFile()

  if (lockData && isProcessRunning(lockData.pid)) {
    try {
      process.kill(lockData.pid, 'SIGTERM')
    } catch {
    }
    await new Promise((r) => setTimeout(r, 500))
    await removeLockFile()
  }

  const effectiveConfigFile = configFile || lockData?.configPath

  if (!effectiveConfigFile) {
    Effect.runSync(Console.error('Error: No config file specified and none found in lock file'))
    process.exit(1)
  }

  const child = spawn('bun', ['run', 'src/cli/index.ts', 'start', effectiveConfigFile], {
    env: { ...process.env, PORT: '0' },
    stdio: 'ignore',
    detached: true,
  })
  child.unref()

  let attempts = 0
  while (attempts < 50) {
    await new Promise((r) => setTimeout(r, 200))
    const newLock = await readLockFile()
    if (newLock && newLock.pid !== lockData?.pid) {
      Effect.runSync(Console.log('Server restarted successfully'))
      return
    }
    attempts++
  }

  Effect.runSync(Console.error('Error: Timed out waiting for new server to start'))
  process.exit(1)
}
