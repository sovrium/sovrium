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
 * This runs once per test run, not per worker.
 */
export default async function globalSetup() {
  console.log('🚀 Initializing global test database...')

  // Ensure Docker daemon is running (auto-install/start if needed)
  // On macOS: auto-installs Colima if no Docker found
  // On Linux/Windows: starts existing Docker installation
  await ensureDockerRunning()

  // Start Mailpit container for email testing
  await startGlobalMailpit()

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

  // Start PostgreSQL container
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()

  const connectionUrl = container.getConnectionUri()

  // Store connection URL for test workers
  process.env.TEST_DATABASE_CONTAINER_URL = connectionUrl

  // Create template manager and initialize template database
  const templateManager = new DatabaseTemplateManager(connectionUrl)
  await templateManager.createTemplate()

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
