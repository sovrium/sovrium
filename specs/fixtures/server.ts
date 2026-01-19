/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { DatabaseTemplateManager, generateTestDatabaseName } from './database'
import { MailpitHelper } from './email'
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { ChildProcess } from 'node:child_process'

/**
 * Global PostgreSQL container and database template manager
 * Initialized once per test run, shared across all workers
 */
let globalPostgresContainer: StartedPostgreSqlContainer | null = null
let globalTemplateManager: DatabaseTemplateManager | null = null

/**
 * Global process registry to track all spawned server processes
 * Used for emergency cleanup in case tests crash before fixture teardown
 */
const activeServerProcesses = new Set<ChildProcess>()

/**
 * Helper function to extract port from server output
 */
function extractPortFromOutput(output: string): number | null {
  const match = output.match(/Homepage: http:\/\/localhost:(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : null
}

/**
 * Helper function to check if DEBUG logging is enabled for a given namespace
 * Supports wildcards and comma-separated namespaces like debug package
 * Examples:
 *   DEBUG=* (all)
 *   DEBUG=sovrium:* (all sovrium namespaces)
 *   DEBUG=sovrium:server (specific namespace)
 *   DEBUG=sovrium:server,sovrium:auth (multiple namespaces)
 */
function shouldLogDebug(namespace: string): boolean {
  const DEBUG = process.env.DEBUG
  if (!DEBUG) return false
  if (DEBUG === '*') return true

  const patterns = DEBUG.split(',').map((p) => p.trim())
  return patterns.some((pattern) => {
    if (pattern === '*') return true
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2)
      return namespace.startsWith(prefix)
    }
    return namespace === pattern
  })
}

/**
 * Helper function to wait for server to be ready and extract port
 * Now supports DEBUG environment variable for filtering server logs
 * Set DEBUG=sovrium:server to see all server output during tests
 */
async function waitForServerPort(
  serverProcess: ChildProcess,
  maxAttempts: number = 50
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const outputBuffer: string[] = []
    const debugEnabled = shouldLogDebug('sovrium:server')

    const checkOutput = (data: Buffer, stream: 'stdout' | 'stderr') => {
      const output = data.toString()
      outputBuffer.push(output)

      // Display server logs if DEBUG is enabled
      if (debugEnabled) {
        const prefix = stream === 'stderr' ? '[SERVER:ERR]' : '[SERVER:OUT]'
        // Split by lines and prefix each line
        output
          .split('\n')
          .filter((line) => line.trim())
          .forEach((line) => {
            console.log(`${prefix} ${line}`)
          })
      }

      const port = extractPortFromOutput(output)
      if (port) {
        resolve(port)
      }
    }

    serverProcess.stdout?.on('data', (data) => checkOutput(data, 'stdout'))
    serverProcess.stderr?.on('data', (data) => checkOutput(data, 'stderr'))

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server process: ${error.message}`))
    })

    const interval = setInterval(() => {
      attempts++
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        reject(
          new Error(
            `Server did not start within ${maxAttempts * 100}ms. Output: ${outputBuffer.join('\n')}`
          )
        )
      }
    }, 100)

    // Clean up interval when port is found
    serverProcess.once('exit', () => {
      clearInterval(interval)
      reject(new Error(`Server exited before starting. Output: ${outputBuffer.join('\n')}`))
    })
  })
}

/**
 * Get or create global database template manager
 * Lazily initializes on first use
 */
export async function getTemplateManager(): Promise<DatabaseTemplateManager> {
  if (globalTemplateManager) {
    return globalTemplateManager
  }

  // Check if running in global setup context (connection URL in env)
  const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
  if (!connectionUrl) {
    throw new Error(
      'Database container not initialized. Ensure globalSetup is configured in playwright.config.ts'
    )
  }

  // Create template manager (template already created in global setup)
  globalTemplateManager = new DatabaseTemplateManager(connectionUrl)
  return globalTemplateManager
}

/**
 * Initialize global PostgreSQL container and database template
 * Called once before all tests
 */
export async function initializeGlobalDatabase(): Promise<void> {
  if (globalPostgresContainer) {
    return // Already initialized
  }

  // Start PostgreSQL container
  globalPostgresContainer = await new PostgreSqlContainer('postgres:16-alpine').withReuse().start()

  const connectionUrl = globalPostgresContainer.getConnectionUri()

  // Store connection URL for test workers
  process.env.TEST_DATABASE_CONTAINER_URL = connectionUrl

  // Create template manager and initialize template database
  globalTemplateManager = new DatabaseTemplateManager(connectionUrl)
  await globalTemplateManager.createTemplate()
}

/**
 * Cleanup global PostgreSQL container and template
 * Called once after all tests
 */
export async function cleanupGlobalDatabase(): Promise<void> {
  if (globalTemplateManager) {
    await globalTemplateManager.cleanup()
    globalTemplateManager = null
  }

  if (globalPostgresContainer) {
    await globalPostgresContainer.stop()
    globalPostgresContainer = null
  }
}

/**
 * Helper function to kill process tree (parent + all children)
 * More reliable than just killing parent process
 */
async function killProcessTree(pid: number): Promise<void> {
  try {
    // On macOS/Linux: kill entire process group
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // Use negative PID to kill process group
      process.kill(-pid, 'SIGKILL')
    } else {
      // Windows: use taskkill
      const { execSync } = await import('node:child_process')
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
    }
  } catch {
    // Process might already be dead, ignore errors
  }
}

/**
 * Helper function to stop the server gracefully with improved reliability
 * - Tries SIGTERM first (graceful shutdown)
 * - Falls back to SIGKILL after 1 second
 * - Kills entire process tree to prevent zombie child processes
 * - Removes from global registry
 */
export async function stopServer(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        if (timeoutId) clearTimeout(timeoutId)

        activeServerProcesses.delete(serverProcess)
        resolve()
      }
    }

    // Listen for exit event
    serverProcess.once('exit', cleanup)

    // Try graceful shutdown with SIGTERM
    try {
      serverProcess.kill('SIGTERM')
    } catch {
      // Process might already be dead
      cleanup()
      return
    }

    // Force kill after 1 second if still running
    timeoutId = setTimeout(async () => {
      if (!resolved) {
        try {
          // Kill entire process tree (more reliable than just parent)
          if (serverProcess.pid) {
            await killProcessTree(serverProcess.pid)
          }
          // Also try direct SIGKILL as fallback
          serverProcess.kill('SIGKILL')
        } catch {
          // Process might already be dead
        }
        cleanup()
      }
    }, 1000)
  })
}

/**
 * Emergency cleanup: Kill all active server processes
 * Called by global teardown or can be invoked manually
 * Useful for cleaning up zombie processes left by crashed tests
 */
export async function killAllServerProcesses(): Promise<void> {
  if (activeServerProcesses.size === 0) {
    return
  }

  const killPromises = Array.from(activeServerProcesses).map((process) => stopServer(process))
  await Promise.allSettled(killPromises)

  // Final check: kill any remaining Bun processes running src/cli.ts
  try {
    const { execSync } = await import('node:child_process')
    if (process.platform === 'darwin' || process.platform === 'linux') {
      execSync('pkill -9 -f "bun.*src/cli.ts" || true', { stdio: 'ignore' })
    }
  } catch {
    // Ignore errors - processes might already be dead
  }
}

/**
 * Admin bootstrap configuration options
 */
export interface AdminBootstrapOptions {
  readonly email?: string
  readonly password?: string
  readonly name?: string
}

/**
 * Helper function to start the CLI server with given app schema
 * Uses port 0 to let Bun automatically select an available port
 */
export async function startCliServer(
  appSchema: object,
  databaseUrl?: string,
  adminBootstrap?: AdminBootstrapOptions
): Promise<{
  process: ChildProcess
  url: string
  port: number
}> {
  // Configure SMTP to use Mailpit for all email sending
  const mailpit = new MailpitHelper()
  const smtpEnv = mailpit.getSmtpEnv('noreply@sovrium.com', { fromName: 'Sovrium' })

  // Start the server with CLI command using port 0 (Bun auto-selects available port)
  const serverProcess = spawn('bun', ['run', 'src/cli.ts'], {
    env: {
      ...process.env,
      APP_SCHEMA: JSON.stringify(appSchema),
      PORT: '0', // Let Bun select an available port
      ...(databaseUrl && { DATABASE_URL: databaseUrl }),
      ...smtpEnv, // Configure SMTP to use Mailpit
      AUTH_SECRET: 'test-secret-for-e2e-testing-32chars', // Required for auth token signing (min 32 chars)
      ...(adminBootstrap && {
        ...(adminBootstrap.email && { AUTH_ADMIN_EMAIL: adminBootstrap.email }),
        ...(adminBootstrap.password && { AUTH_ADMIN_PASSWORD: adminBootstrap.password }),
        ...(adminBootstrap.name && { AUTH_ADMIN_NAME: adminBootstrap.name }),
      }),
    },
    stdio: 'pipe',
  })

  // Register process in global registry for emergency cleanup
  activeServerProcesses.add(serverProcess)

  // Ensure cleanup on process crash/exit
  serverProcess.once('exit', () => {
    activeServerProcesses.delete(serverProcess)
  })

  try {
    // Wait for server to start and extract the actual port Bun selected
    const port = await waitForServerPort(serverProcess)
    const url = `http://localhost:${port}`

    // Verify server is ready by checking health endpoint with retries
    // The server may not be fully ready immediately after port detection
    const maxHealthRetries = 10
    let lastError: Error | null = null

    for (let i = 0; i < maxHealthRetries; i++) {
      try {
        const response = await fetch(`${url}/api/health`)
        if (response.ok) {
          return { process: serverProcess, url, port }
        }
        lastError = new Error(`Health check failed with status ${response.status}`)
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError))
      }

      // Wait before retrying (50ms, 100ms, 150ms, ...)
      if (i < maxHealthRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)))
      }
    }

    throw lastError || new Error('Health check failed after retries')
  } catch (error) {
    // Cleanup on startup failure

    activeServerProcesses.delete(serverProcess)
    await stopServer(serverProcess)
    throw error
  }
}

export { generateTestDatabaseName }
