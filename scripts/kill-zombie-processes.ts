/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'


console.log('🔍 Searching for zombie Bun processes...')

try {
  let count = 0
  try {
    const countOutput = execSync('ps aux | grep -c "bun.*src/cli/index.ts" || true', {
      encoding: 'utf-8',
    })
    count = parseInt(countOutput.trim()) || 0
  } catch {
  }

  if (count === 0) {
    console.log('✅ No zombie processes found')
    process.exit(0)
  }

  console.log(`🧹 Found ${count} zombie processes. Killing...`)

  if (process.platform === 'darwin' || process.platform === 'linux') {
    execSync('pkill -9 -f "bun.*src/cli/index.ts" || true', { stdio: 'inherit' })

    execSync('pkill -9 bun || true', { stdio: 'ignore' })
  } else {
    execSync('taskkill /F /IM bun.exe /T', { stdio: 'ignore' })
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    const remainingOutput = execSync('ps aux | grep -c "bun.*src/cli/index.ts" || true', {
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


console.log('\n🐳 Checking for stale Docker test containers...')

try {
  const dockerContainers = execSync(
    'docker ps --format "{{.ID}}\\t{{.Image}}\\t{{.Names}}\\t{{.RunningFor}}" 2>/dev/null || true',
    { encoding: 'utf-8' }
  ).trim()

  if (!dockerContainers) {
    console.log('✅ No Docker containers running (or Docker not available)')
  } else {
    const testImages = [
      'pgvector/pgvector',
      'postgres:',
      'axllent/mailpit',
      'minio/minio',
      'testcontainers/ryuk',
    ]
    const lines = dockerContainers.split('\n').filter(Boolean)
    const staleContainers: string[] = []

    for (const line of lines) {
      const [id, image] = line.split('\t')
      if (id && image && testImages.some((prefix) => image.startsWith(prefix))) {
        staleContainers.push(id)
      }
    }

    if (staleContainers.length === 0) {
      console.log('✅ No stale test containers found')
    } else {
      console.log(`🧹 Found ${staleContainers.length} test containers. Stopping...`)
      execSync(`docker stop ${staleContainers.join(' ')}`, { stdio: 'ignore', timeout: 30_000 })
      execSync('docker container prune -f', { stdio: 'ignore', timeout: 10_000 })
      console.log(`✅ Removed ${staleContainers.length} stale test containers`)
    }
  }
} catch (error) {
  console.warn(
    '⚠️  Docker cleanup failed (non-fatal):',
    error instanceof Error ? error.message : error
  )
}
