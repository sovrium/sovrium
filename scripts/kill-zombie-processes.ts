/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'

/**
 * Utility script to kill all zombie Bun processes
 *
 * Usage:
 *   bun run scripts/kill-zombie-processes.ts
 *
 * Use this when:
 * - E2E tests left zombie processes running
 * - System is slow due to too many Bun processes
 * - Before running test suite to ensure clean state
 */

console.log('🔍 Searching for zombie Bun processes...')

try {
  // Count processes before cleanup
  let count = 0
  try {
    const countOutput = execSync('ps aux | grep -c "bun.*src/cli.ts" || true', {
      encoding: 'utf-8',
    })
    count = parseInt(countOutput.trim()) || 0
  } catch {
    // Ignore errors
  }

  if (count === 0) {
    console.log('✅ No zombie processes found')
    process.exit(0)
  }

  console.log(`🧹 Found ${count} zombie processes. Killing...`)

  // Kill all Bun processes running src/cli.ts
  if (process.platform === 'darwin' || process.platform === 'linux') {
    // macOS/Linux
    execSync('pkill -9 -f "bun.*src/cli.ts" || true', { stdio: 'inherit' })

    // Also kill any orphaned bun processes
    execSync('pkill -9 bun || true', { stdio: 'ignore' })
  } else {
    // Windows
    execSync('taskkill /F /IM bun.exe /T', { stdio: 'ignore' })
  }

  // Wait a moment for processes to die
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Count remaining processes
  try {
    const remainingOutput = execSync('ps aux | grep -c "bun.*src/cli.ts" || true', {
      encoding: 'utf-8',
    })
    const remaining = parseInt(remainingOutput.trim()) || 0

    if (remaining > 0) {
      console.log(`⚠️  ${remaining} processes still running (might be legitimate)`)
    } else {
      console.log('✅ All zombie processes killed')
    }
  } catch {
    console.log('✅ Cleanup complete')
  }
} catch (error) {
  console.error('❌ Error during cleanup:', error)
  process.exit(1)
}
