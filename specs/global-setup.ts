/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'
import { DatabaseTemplateManager } from './database-utils'
import { ensureDockerRunning } from './docker-utils'
import { startGlobalMailpit, stopGlobalMailpit } from './email-utils'

/**
 * Retry configuration for infrastructure setup
 * Uses longer delays on CI where Docker can be slower to stabilize
 */
const RETRY_CONFIG = {
  maxRetries: process.env.CI ? 3 : 2,
  delayMs: process.env.CI ? 5000 : 2000,
}

/**
 * Helper function to retry an async operation with exponential backoff
 *
 * @param fn - The async function to retry
 * @param name - Human-readable name for logging
 * @param maxRetries - Maximum number of retry attempts (default: from RETRY_CONFIG)
 * @param delayMs - Base delay between retries in milliseconds (default: from RETRY_CONFIG)
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  name: string,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  delayMs: number = RETRY_CONFIG.delayMs
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        // Exponential backoff: delay * 2^(attempt-1)
        const actualDelay = delayMs * Math.pow(2, attempt - 1)
        console.log(`⚠️ ${name} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`)
        console.log(`⏳ Retrying in ${actualDelay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, actualDelay))
      }
    }
  }

  // All retries exhausted
  throw new Error(`${name} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`)
}

/**
 * Playwright Global Setup
 *
 * Initializes shared resources before all tests run:
 * - Ensures Docker daemon is running (auto-installs Colima on macOS if needed)
 * - Starts PostgreSQL testcontainer
 * - Creates database template with all migrations applied
 * - Stores container connection URL in environment for test workers
 *
 * **Note:** Docker Desktop is NOT required. This works with any Docker-compatible runtime:
 * - Colima (macOS) - auto-installed if missing
 * - Docker Engine (Linux)
 * - Podman (all platforms)
 * - Docker Desktop (all platforms) - if already installed
 *
 * **Retry Logic:** Infrastructure startup operations are automatically retried
 * to handle transient failures (Docker startup delays, network issues, etc.)
 *
 * This runs once per test run, not per worker.
 */
export default async function globalSetup() {
  console.log('🚀 Initializing global test database...')

  // Ensure Docker daemon is running (auto-install/start if needed)
  // On macOS: auto-installs Colima if no Docker found
  // On Linux/Windows: starts existing Docker installation
  await withRetry(() => ensureDockerRunning(), 'Docker startup')

  // Start Mailpit container for email testing (with retry for flaky Docker networking)
  await withRetry(() => startGlobalMailpit(), 'Mailpit startup')

  // Configure testcontainers for Colima
  // Colima maps the socket to the standard Docker path inside the VM
  // Find docker executable
  const dockerPath =
    ['/opt/homebrew/bin/docker', '/usr/local/bin/docker', '/usr/bin/docker'].find((path) => {
      try {
        execSync(`test -x ${path}`, { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }) || 'docker'

  const currentContext = execSync(`${dockerPath} context show`, { encoding: 'utf-8' }).trim()
  if (currentContext === 'colima') {
    // Use the host socket for DOCKER_HOST
    process.env.DOCKER_HOST = `unix://${process.env.HOME}/.colima/docker.sock`
    // But tell testcontainers to mount the VM's socket path
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock'
    console.log(`🔗 Using Colima with Docker socket mapping`)
  }

  // Dynamic import of testcontainers AFTER Docker config is fixed
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')

  // Start PostgreSQL container (with retry for transient Docker issues)
  const container = await withRetry(
    () => new PostgreSqlContainer('postgres:16-alpine').start(),
    'PostgreSQL container startup'
  )

  const connectionUrl = container.getConnectionUri()

  // Store connection URL for test workers
  process.env.TEST_DATABASE_CONTAINER_URL = connectionUrl

  // Create template manager and initialize template database (with retry for DB setup)
  const templateManager = new DatabaseTemplateManager(connectionUrl)
  await withRetry(() => templateManager.createTemplate(), 'Database template creation')

  console.log('✅ Global test database ready')

  // Return teardown function
  return async () => {
    console.log('🧹 Cleaning up global test resources...')
    await templateManager.cleanup()
    await container.stop()
    await stopGlobalMailpit()
    console.log('✅ Global test resources cleaned up')
  }
}
