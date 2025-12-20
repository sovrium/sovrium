/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'

/**
 * Playwright Global Teardown
 *
 * Cleanup shared resources after all tests complete:
 * - Kills any remaining server processes (zombie cleanup)
 * - Database cleanup is handled by the teardown function returned from global-setup.ts
 *
 * This runs once per test run, after all workers complete.
 * Ensures no orphaned processes remain even if tests crash.
 *
 * Note: Uses direct process killing instead of activeServerProcesses Set
 * because the Set is worker-local and not shared with the main process.
 */
export default async function globalTeardown() {
  try {
    // Kill all Bun processes running src/cli.ts (cleanup zombies)
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        execSync('pkill -9 -f "bun.*src/cli.ts"', { stdio: 'ignore' })
      } else {
        execSync('taskkill /F /IM bun.exe /T', { stdio: 'ignore' })
      }
    } catch {
      // Ignore - pkill returns non-zero if no processes found
    }
  } catch (error) {
    console.error(`⚠️ Cleanup error: ${error}`)
  }
}
