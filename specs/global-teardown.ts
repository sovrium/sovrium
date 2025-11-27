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
  console.log('🧹 Running global teardown...')

  try {
    // Count remaining Bun processes running src/cli.ts
    let count = 0
    try {
      const countOutput = execSync('ps aux | grep -c "bun.*src/cli.ts" || true', {
        encoding: 'utf-8',
      })
      count = parseInt(countOutput.trim()) || 0
    } catch {
      // Ignore errors
    }

    if (count > 0) {
      console.log(`🧹 Killing ${count} remaining server processes...`)

      // Kill all Bun processes running src/cli.ts
      // Wrapped in try/catch because pkill can throw even with || true
      // (execSync throws on abnormal process termination)
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          execSync('pkill -9 -f "bun.*src/cli.ts"', { stdio: 'ignore' })
        } else {
          // Windows
          execSync('taskkill /F /IM bun.exe /T', { stdio: 'ignore' })
        }
      } catch {
        // Ignore - pkill returns non-zero if no processes found or on SIGKILL
      }

      console.log('✅ Server processes cleaned up')
    }
  } catch (error) {
    console.error('⚠️  Error during cleanup:', error)
  }

  console.log('✅ Global teardown complete')
}
