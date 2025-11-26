/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from '@playwright/test'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { DatabaseTemplateManager, generateTestDatabaseName } from './database-utils'
import type { App } from '@/domain/models/app'
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { ChildProcess } from 'node:child_process'

/**
 * Global PostgreSQL container and database template manager
 * Initialized once per test run, shared across all workers
 */
let globalPostgresContainer: StartedPostgreSqlContainer | null = null
let globalTemplateManager: DatabaseTemplateManager | null = null

/**
 * Helper function to extract port from server output
 */
function extractPortFromOutput(output: string): number | null {
  const match = output.match(/Homepage: http:\/\/localhost:(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : null
}

/**
 * Helper function to wait for server to be ready and extract port
 */
async function waitForServerPort(
  serverProcess: ChildProcess,
  maxAttempts: number = 50
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const outputBuffer: string[] = []

    const checkOutput = (data: Buffer) => {
      const output = data.toString()
      outputBuffer.push(output)

      const port = extractPortFromOutput(output)
      if (port) {
        resolve(port)
      }
    }

    serverProcess.stdout?.on('data', checkOutput)
    serverProcess.stderr?.on('data', checkOutput)

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
async function getTemplateManager(): Promise<DatabaseTemplateManager> {
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
 * Emergency cleanup: Kill all active server processes
 * Called by global teardown or can be invoked manually
 * Useful for cleaning up zombie processes left by crashed tests
 */
export async function killAllServerProcesses(): Promise<void> {
  if (activeServerProcesses.size === 0) {
    return
  }

  console.log(`🧹 Killing ${activeServerProcesses.size} active server processes...`)

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

  console.log('✅ All server processes cleaned up')
}

/**
 * Helper function to start the CLI server with given app schema
 * Uses port 0 to let Bun automatically select an available port
 */
async function startCliServer(
  appSchema: object,
  databaseUrl?: string
): Promise<{
  process: ChildProcess
  url: string
  port: number
}> {
  // Start the server with CLI command using port 0 (Bun auto-selects available port)
  const serverProcess = spawn('bun', ['run', 'src/cli.ts'], {
    env: {
      ...process.env,
      SOVRIUM_APP_SCHEMA: JSON.stringify(appSchema),
      SOVRIUM_PORT: '0', // Let Bun select an available port
      ...(databaseUrl && { DATABASE_URL: databaseUrl }),
    },
    stdio: 'pipe',
  })

  // Register process in global registry for emergency cleanup
  activeServerProcesses.add(serverProcess)

  // Ensure cleanup on process crash/exit
  serverProcess.once('exit', () => {
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    activeServerProcesses.delete(serverProcess)
  })

  try {
    // Wait for server to start and extract the actual port Bun selected
    const port = await waitForServerPort(serverProcess)
    const url = `http://localhost:${port}`

    // Verify server is ready by checking health endpoint
    const response = await fetch(`${url}/api/health`)
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`)
    }

    return { process: serverProcess, url, port }
  } catch (error) {
    // Cleanup on startup failure
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    activeServerProcesses.delete(serverProcess)
    await stopServer(serverProcess)
    throw error
  }
}

/**
 * Global process registry to track all spawned server processes
 * Used for emergency cleanup in case tests crash before fixture teardown
 */
const activeServerProcesses = new Set<ChildProcess>()

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
async function stopServer(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        if (timeoutId) clearTimeout(timeoutId)
        // eslint-disable-next-line drizzle/enforce-delete-with-where
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
 * Custom fixtures for CLI server with AppSchema configuration and database isolation
 */
type ServerFixtures = {
  startServerWithSchema: (
    appSchema: App,
    options?: { useDatabase?: boolean; database?: { url: string } }
  ) => Promise<void>
  executeQuery: (
    sql: string | string[],
    params?: unknown[]
  ) => Promise<{
    rows: any[]
    rowCount: number
    [key: string]: any
  }>
  applyMigration: (migration: {
    type: string
    tableId?: string
    fieldId?: string
    constraint?: { type: string; defaultValue?: string }
  }) => Promise<void>
  browserLocale: string | undefined
  mockAnalytics: boolean
  generateStaticSite: (
    appSchema: App,
    config?: {
      publicDir?: string
      baseUrl?: string
      basePath?: string
      deployment?: 'github-pages' | 'generic'
      languages?: string[]
      defaultLanguage?: string
      generateSitemap?: boolean
      generateRobotsTxt?: boolean
      hydration?: boolean
      generateManifest?: boolean
      bundleOptimization?: 'split' | 'none'
    }
  ) => Promise<string>
}

/**
 * Extend Playwright test with server fixture
 * Provides:
 * - startServerWithSchema: Function to start server with custom AppSchema configuration
 *   - When options.useDatabase is true, creates an isolated test database
 * - browserLocale: Optional locale string (e.g., 'fr-FR') to set browser language
 * - mockAnalytics: Boolean flag to mock external analytics providers (default: true)
 *   - Prevents flakiness from external script loading (Google, Plausible, Matomo, etc.)
 *   - Disable with: test.use({ mockAnalytics: false })
 * Server and database are automatically cleaned up after test completion
 * Configures baseURL for relative navigation with page.goto('/')
 */
export const test = base.extend<ServerFixtures>({
  // Browser locale fixture: allows tests to specify a locale (e.g., 'fr-FR')
  browserLocale: [undefined, { option: true }],

  // Analytics mocking fixture: automatically mocks external analytics providers
  // Enabled by default to prevent flakiness from external script loading
  mockAnalytics: [true, { option: true }],

  // Override context to use browserLocale if specified
  context: async ({ browser, browserLocale }, use) => {
    const context = await browser.newContext(browserLocale ? { locale: browserLocale } : {})
    await use(context)
    await context.close()
  },

  // Override page to mock analytics providers if mockAnalytics is enabled
  page: async ({ page, mockAnalytics }, use) => {
    if (mockAnalytics) {
      // Mock all common analytics providers to prevent flakiness
      // Returns empty 200 responses - we're testing DOM rendering, not actual analytics
      await page.route('**/plausible.io/**', (route) => route.fulfill({ status: 200, body: '' }))
      await page.route('**/googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, body: '' })
      )
      await page.route('**/google-analytics.com/**', (route) =>
        route.fulfill({ status: 200, body: '' })
      )
      await page.route('**/posthog.com/**', (route) => route.fulfill({ status: 200, body: '' }))
      await page.route('**/matomo.org/**', (route) => route.fulfill({ status: 200, body: '' }))
      await page.route('**/usefathom.com/**', (route) => route.fulfill({ status: 200, body: '' }))
      await page.route('**/mixpanel.com/**', (route) => route.fulfill({ status: 200, body: '' }))
    }

    await use(page)
  },

  // Server fixture: Start server with custom schema and optional database
  startServerWithSchema: async ({ page }, use, testInfo) => {
    let serverProcess: ChildProcess | null = null
    let serverUrl = ''
    let testDbName: string | null = null

    // Provide function to start server with custom schema
    await use(async (appSchema: App, options?: { useDatabase?: boolean }) => {
      let databaseUrl: string | undefined = undefined

      // Enable database by default (can be disabled with useDatabase: false)
      if (options?.useDatabase !== false) {
        const templateManager = await getTemplateManager()
        testDbName = generateTestDatabaseName(testInfo)
        databaseUrl = await templateManager.duplicateTemplate(testDbName)
      }

      const server = await startCliServer(appSchema, databaseUrl)
      serverProcess = server.process
      serverUrl = server.url

      // Set baseURL for page assertions (toHaveURL with relative paths)
      // This needs to be done by navigating with baseURL or by creating a new page with baseURL
      // Since we can't modify the context after creation, we'll override the page object
      // @ts-expect-error - We need to set baseURL for relative URL assertions
      page._browserContext._options.baseURL = serverUrl

      // Override page.goto to prepend baseURL for relative paths
      const originalGoto = page.goto.bind(page)
      page.goto = (url: string, options?: Parameters<typeof page.goto>[1]) => {
        const fullUrl = url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalGoto(fullUrl, options)
      }

      // Override page.request methods to prepend serverUrl for relative paths
      const originalPost = page.request.post.bind(page.request)
      const originalGet = page.request.get.bind(page.request)
      const originalPut = page.request.put.bind(page.request)
      // eslint-disable-next-line drizzle/enforce-delete-with-where
      const originalDelete = page.request.delete.bind(page.request)
      const originalPatch = page.request.patch.bind(page.request)

      page.request.post = (urlOrRequest, options?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalPost(fullUrl, options)
      }

      page.request.get = (urlOrRequest, options?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalGet(fullUrl, options)
      }

      page.request.put = (urlOrRequest, options?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalPut(fullUrl, options)
      }

      // eslint-disable-next-line drizzle/enforce-delete-with-where
      page.request.delete = (urlOrRequest, options?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalDelete(fullUrl, options)
      }

      page.request.patch = (urlOrRequest, options?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalPatch(fullUrl, options)
      }
    })

    // Cleanup: Stop server after test
    if (serverProcess) {
      await stopServer(serverProcess)
    }

    // Cleanup: Drop test database if it was created
    if (testDbName) {
      const templateManager = await getTemplateManager()
      await templateManager.dropTestDatabase(testDbName)
    }
  },

  // Execute SQL query fixture: Run raw SQL queries against the test database
  executeQuery: async ({}, use, testInfo) => {
    let client: any = null

    await use(async (query: string | string[], params?: unknown[]) => {
      const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
      if (!connectionUrl) {
        throw new Error('Database not initialized')
      }

      // Import pg module
      const { Client } = await import('pg')

      // Generate test database name to connect to the specific test database
      const testDbName = generateTestDatabaseName(testInfo)

      // Parse the connection URL and replace the database name
      const url = new URL(connectionUrl)
      const pathParts = url.pathname.split('/')
      pathParts[1] = testDbName // Replace database name
      url.pathname = pathParts.join('/')

      // Create pg client for the test database
      client = new Client({ connectionString: url.toString() })
      await client.connect()

      // Handle both single query and array of queries
      if (Array.isArray(query)) {
        // Execute queries sequentially
        let lastResult: any = { rows: [], rowCount: 0 }
        for (const sql of query) {
          const result = await client.query(sql)
          const rows = result.rows
          const rowCount = result.rowCount || 0
          // Spread first row properties if there's exactly one row (for convenient property access)
          lastResult = rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
        }
        return lastResult
      } else {
        const result = params ? await client.query(query, params) : await client.query(query)
        const rows = result.rows
        const rowCount = result.rowCount || 0
        // Spread first row properties if there's exactly one row (for convenient property access)
        return rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
      }
    })

    // Cleanup: Close connection
    if (client) {
      await client.end()
    }
  },

  // Apply migration fixture: Apply schema migrations (stub for .fixme tests)
  applyMigration: async ({}, use) => {
    await use(async (_migration: Parameters<ServerFixtures['applyMigration']>[0]) => {
      // Stub implementation for .fixme tests
      // TODO: Implement actual migration application when migration system is built
      throw new Error('applyMigration is not yet implemented - this is a stub for .fixme tests')
    })
  },

  // Static site generation fixture: Generate static files using CLI command
  generateStaticSite: async ({}, use) => {
    const tempDirs: string[] = []

    await use(
      async (appSchema: App, config?: Parameters<ServerFixtures['generateStaticSite']>[1]) => {
        // Create temporary output directory
        const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-static-'))
        const outputDir = join(tempDir, 'dist')
        tempDirs.push(tempDir)

        // Build environment variables from config
        const env: Record<string, string> = {
          ...process.env,
          SOVRIUM_APP_SCHEMA: JSON.stringify(appSchema),
          SOVRIUM_OUTPUT_DIR: outputDir,
        }

        if (config?.baseUrl) env.SOVRIUM_BASE_URL = config.baseUrl
        if (config?.basePath) env.SOVRIUM_BASE_PATH = config.basePath
        if (config?.deployment) env.SOVRIUM_DEPLOYMENT = config.deployment
        if (config?.languages) env.SOVRIUM_LANGUAGES = config.languages.join(',')
        if (config?.defaultLanguage) env.SOVRIUM_DEFAULT_LANGUAGE = config.defaultLanguage
        if (config?.generateSitemap !== undefined) {
          env.SOVRIUM_GENERATE_SITEMAP = String(config.generateSitemap)
        }
        if (config?.generateRobotsTxt !== undefined) {
          env.SOVRIUM_GENERATE_ROBOTS = String(config.generateRobotsTxt)
        }
        if (config?.hydration !== undefined) {
          env.SOVRIUM_HYDRATION = String(config.hydration)
        }
        if (config?.generateManifest !== undefined) {
          env.SOVRIUM_GENERATE_MANIFEST = String(config.generateManifest)
        }
        if (config?.bundleOptimization) {
          env.SOVRIUM_BUNDLE_OPTIMIZATION = config.bundleOptimization
        }
        if (config?.publicDir) {
          env.SOVRIUM_PUBLIC_DIR = config.publicDir
        }

        // Execute CLI command
        await new Promise<void>((resolve, reject) => {
          const process = spawn('bun', ['run', 'src/cli.ts', 'static'], {
            env,
            stdio: 'pipe',
          })

          const outputBuffer: string[] = []

          process.stdout?.on('data', (data) => {
            outputBuffer.push(data.toString())
          })

          process.stderr?.on('data', (data) => {
            outputBuffer.push(data.toString())
          })

          process.on('exit', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(
                new Error(
                  `Static generation failed with code ${code}. Output: ${outputBuffer.join('\n')}`
                )
              )
            }
          })

          process.on('error', (error) => {
            reject(new Error(`Failed to spawn process: ${error.message}`))
          })
        })

        return outputDir
      }
    )

    // Cleanup: Remove all temporary directories
    for (const tempDir of tempDirs) {
      await rm(tempDir, { recursive: true, force: true })
    }
  },
})

export { expect } from '@playwright/test'
export type { Locator } from '@playwright/test'
