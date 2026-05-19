/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'

export const handleStopCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    Effect.runSync(Console.error('Error: No server is running (lock file not found)'))
    process.exit(1)
  }

  try {
    process.kill(lockData.pid, 'SIGTERM')
  } catch {
  }

  await new Promise((r) => setTimeout(r, 500))
  await removeLockFile()
  Effect.runSync(Console.log('Server stopped successfully'))
}
