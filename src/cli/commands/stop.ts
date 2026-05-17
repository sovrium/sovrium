/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

/**
 * Handle the 'stop' command -- read PID from lock file and send SIGTERM
 */
export const handleStopCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    Effect.runSync(Console.error('Error: No server is running (lock file not found)'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    // eslint-disable-next-line functional/no-expression-statements
    process.kill(lockData.pid, 'SIGTERM')
  } catch {
    // Process may already be dead
  }

  // Wait briefly for process to exit, then clean up lock file
  // eslint-disable-next-line functional/no-expression-statements
  await new Promise((r) => setTimeout(r, 500))
  // eslint-disable-next-line functional/no-expression-statements
  await removeLockFile()
  Effect.runSync(Console.log('Server stopped successfully'))
}
