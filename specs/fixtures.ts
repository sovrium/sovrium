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
import { MailpitHelper, generateTestId } from './email-utils'
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
  // Configure SMTP to use Mailpit for all email sending
  const mailpit = new MailpitHelper()
  const smtpEnv = mailpit.getSmtpEnv('noreply@sovrium.com', { fromName: 'Sovrium' })

  // Start the server with CLI command using port 0 (Bun auto-selects available port)
  const serverProcess = spawn('bun', ['run', 'src/cli.ts'], {
    env: {
      ...process.env,
      SOVRIUM_APP_JSON: JSON.stringify(appSchema),
      PORT: '0', // Let Bun select an available port
      ...(databaseUrl && { DATABASE_URL: databaseUrl }),
      ...smtpEnv, // Configure SMTP to use Mailpit
      BETTER_AUTH_SECRET: 'test-secret-for-e2e-testing', // Required for Better Auth token signing
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
 * Auth-related types for test fixtures
 */
type AuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

type AuthSession = {
  id: string
  userId: string
  token: string
  expiresAt: string
}

type SignUpData = {
  email: string
  password: string
  name: string
}

type SignInData = {
  email: string
  password: string
  rememberMe?: boolean
}

type AuthResult = {
  user: AuthUser
  session?: AuthSession
  token?: string // Convenience alias for session.token
}

type Organization = {
  id: string
  name: string
  slug: string
  logo?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

type OrganizationResult = {
  organization: Organization
}

type Invitation = {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
  expiresAt: string
  inviterId: string
}

type InvitationResult = {
  invitation: Invitation
}

type Membership = {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: string
}

type MembershipResult = {
  member: Membership
}

/**
 * Custom fixtures for CLI server with AppSchema configuration and database isolation
 */
type ServerFixtures = {
  startServerWithSchema: (
    appSchema: App,
    options?: { useDatabase?: boolean; database?: { url: string } }
  ) => Promise<void>
  /**
   * Execute raw SQL queries against the test database.
   *
   * **IMPORTANT: Return Value Behavior**
   *
   * The return object always has `rows` and `rowCount` properties.
   * - For SINGLE ROW results: first row properties are spread onto the object
   *   → Use `result.columnName` directly
   * - For MULTIPLE ROWS: only `rows` and `rowCount` are available
   *   → Use `result.rows` to access the array
   *
   * @example Single row query
   * ```ts
   * const user = await executeQuery("SELECT name FROM users WHERE id = 1")
   * expect(user.name).toBe('Alice')  // Direct access works
   * expect(user.rows[0].name).toBe('Alice')  // Also works
   * ```
   *
   * @example Multiple rows query
   * ```ts
   * const users = await executeQuery("SELECT name FROM users")
   * expect(users.rows).toHaveLength(3)  // Use .rows for array
   * expect(users.rows[0].name).toBe('Alice')
   * // ❌ WRONG: expect(users).toEqual([...])  // users is NOT an array!
   * // ✅ RIGHT: expect(users.rows).toEqual([...])
   * ```
   */
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

  /**
   * Sign up a new user
   * Creates a new user account with the provided credentials
   * @returns The created user data
   */
  signUp: (data: SignUpData) => Promise<AuthResult>

  /**
   * Sign in with email and password
   * Authenticates the user and sets session cookies automatically
   * Subsequent page.request calls will include auth cookies
   * @returns The authenticated user and session data
   */
  signIn: (data: SignInData) => Promise<AuthResult>

  /**
   * Sign out the current user
   * Clears session cookies
   */
  signOut: () => Promise<void>

  /**
   * Create and authenticate a test user in one call
   * Convenience fixture that combines signUp + signIn
   * @returns The authenticated user and session data
   */
  createAuthenticatedUser: (data?: Partial<SignUpData>) => Promise<AuthResult>

  /**
   * Create and authenticate an admin user
   * Creates a user, sets role to admin, then signs in
   * @returns The authenticated admin user and session data
   */
  createAuthenticatedAdmin: (data?: Partial<SignUpData>) => Promise<AuthResult>

  /**
   * Create and authenticate a viewer user
   * Creates a user, sets role to viewer (read-only), then signs in
   * @returns The authenticated viewer user and session data
   */
  createAuthenticatedViewer: (data?: Partial<SignUpData>) => Promise<AuthResult>

  /**
   * Create a new organization via API
   * Requires an authenticated user (call createAuthenticatedUser first)
   * @returns The created organization data
   */
  createOrganization: (data: { name: string; slug?: string }) => Promise<OrganizationResult>

  /**
   * Invite a member to an organization via API
   * Requires an authenticated user who is owner/admin of the organization
   * @returns The invitation data
   */
  inviteMember: (data: {
    organizationId: string
    email: string
    role?: 'admin' | 'member'
  }) => Promise<InvitationResult>

  /**
   * Accept an organization invitation via API
   * Requires an authenticated user who received the invitation
   * @returns The membership data
   */
  acceptInvitation: (invitationId: string) => Promise<MembershipResult>

  /**
   * Add a member directly to an organization via API
   * Requires an authenticated user who is owner/admin of the organization
   * @returns The membership data
   */
  addMember: (data: {
    organizationId: string
    userId: string
    role?: 'admin' | 'member'
  }) => Promise<MembershipResult>

  /**
   * Mailpit helper for email testing
   * Provides methods to interact with the Mailpit SMTP server and verify emails.
   * Each test gets an isolated mailbox (emails cleared at start).
   *
   * @example
   * ```typescript
   * test('should send welcome email', async ({ mailpit }) => {
   *   // ... trigger email sending in your app ...
   *
   *   // Wait for email to arrive
   *   const email = await mailpit.waitForEmail(
   *     (e) => e.To[0].Address === 'user@example.com'
   *   )
   *
   *   // Verify email content
   *   expect(email.Subject).toBe('Welcome!')
   *   expect(email.From.Address).toBe('noreply@myapp.com')
   * })
   * ```
   */
  mailpit: MailpitHelper
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
        // Store database name for executeQuery fixture to use
        ;(testInfo as any)._testDatabaseName = testDbName
      }

      // SMTP is automatically configured via environment variables from mailpit
      // (configured in startCliServer - no need to pass email config in schema)
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
    const clients: any[] = []

    await use(async (query: string | string[], params?: unknown[]) => {
      const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
      if (!connectionUrl) {
        throw new Error('Database not initialized')
      }

      // Import pg module and configure type parsers
      const { Client, types } = await import('pg')

      // Parse bigint as number (COUNT, array_length, etc. return bigint)
      // This prevents "2" (string) vs 2 (number) type mismatches in tests
      types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10))

      // Parse NUMERIC/DECIMAL as number (price, currency, percentage fields return numeric)
      // PostgreSQL NUMERIC type (OID 1700) returns strings by default to preserve precision
      // Convert to number for test assertions while accepting precision loss for test simplicity
      types.setTypeParser(types.builtins.NUMERIC, (val: string) => parseFloat(val))

      // Parse DATE as string (keep ISO format YYYY-MM-DD)
      // PostgreSQL DATE type (OID 1082) returns Date objects by default
      // Convert to string for test assertions to match expected format
      types.setTypeParser(types.builtins.DATE, (val: string) => val)

      // Parse POINT as string (keep (x,y) format)
      // PostgreSQL POINT type (OID 600) returns string in format "(x,y)"
      // Keep as string for test assertions to match expected format
      types.setTypeParser(600 as any, (val: string) => val)

      // Parse JSONB conditionally based on query context
      // PostgreSQL JSONB type (OID 3802) behavior:
      // - Full JSONB columns: parse to JavaScript objects/arrays (test JSON-001)
      // - -> operator results: keep as JSON string with quotes (test JSON-002)
      // - ->> operator results: returns TEXT type, not JSONB (no parser needed)
      const queryStr = typeof query === 'string' ? query : query.join(' ')
      const hasArrowOperator = /->(?!>)/.test(queryStr) // Matches -> but not ->>

      if (hasArrowOperator) {
        // Query uses -> operator - preserve JSON string representation
        // Example: SELECT config -> 'theme' returns JSONB '"dark"' (keep as string)
        types.setTypeParser(types.builtins.JSONB, (val: string) => val)
      } else {
        // Query accesses full JSONB columns - parse to JavaScript values
        // Example: SELECT metadata returns JSONB '{"color": "red"}' (parse to {color: 'red'})
        types.setTypeParser(types.builtins.JSONB, (val: string) => JSON.parse(val))
      }

      // Get test database name from startServerWithSchema fixture
      const testDbName = (testInfo as any)._testDatabaseName
      if (!testDbName) {
        throw new Error(
          'Test database not initialized. Call startServerWithSchema before executeQuery.'
        )
      }

      // Parse the connection URL and replace the database name
      const url = new URL(connectionUrl)
      const pathParts = url.pathname.split('/')
      pathParts[1] = testDbName // Replace database name
      url.pathname = pathParts.join('/')

      // Create pg client for the test database
      const client = new Client({ connectionString: url.toString() })
      clients.push(client)
      await client.connect()

      try {
        // Handle both single query and array of queries
        if (Array.isArray(query)) {
          // Execute queries sequentially
          let lastResult: any = { rows: [], rowCount: 0 }
          for (const sql of query) {
            const result = await client.query(sql)
            const rows = result.rows
            const rowCount = result.rowCount || 0
            // Always include rows/rowCount, spread first row for single-row queries
            lastResult = rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
          }
          return lastResult
        } else {
          const result = params ? await client.query(query, params) : await client.query(query)
          const rows = result.rows
          const rowCount = result.rowCount || 0
          // Always include rows/rowCount, spread first row for single-row queries
          return rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
        }
      } finally {
        // Close connection after each query execution
        await client.end()
      }
    })

    // Cleanup: Close any remaining connections (shouldn't be any, but just in case)
    for (const client of clients) {
      try {
        await client.end()
      } catch {
        // Ignore errors during cleanup - connection may already be closed
      }
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
          SOVRIUM_APP_JSON: JSON.stringify(appSchema),
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

  // Auth fixture: Sign up a new user
  signUp: async ({ page }, use) => {
    await use(async (data: SignUpData): Promise<AuthResult> => {
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: data.email,
          password: data.password,
          name: data.name,
        },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Sign up failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await response.json()
      return {
        user: result.user,
        session: result.session,
      }
    })
  },

  // Auth fixture: Sign in with email and password
  // Cookies are automatically set and shared with page.request
  signIn: async ({ page }, use) => {
    await use(async (data: SignInData): Promise<AuthResult> => {
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: data.email,
          password: data.password,
          ...(data.rememberMe !== undefined && { rememberMe: data.rememberMe }),
        },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Sign in failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await response.json()
      return {
        user: result.user,
        session: result.session,
        token: result.session?.token, // Convenience alias
      }
    })
  },

  // Auth fixture: Sign out the current user
  signOut: async ({ page }, use) => {
    await use(async (): Promise<void> => {
      const response = await page.request.post('/api/auth/sign-out')

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Sign out failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  // Auth fixture: Create and authenticate a test user in one call
  // Convenience fixture that combines signUp + signIn with sensible defaults
  createAuthenticatedUser: async ({ page }, use) => {
    let userCounter = 0

    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      userCounter++
      const timestamp = Date.now()
      const defaultData: SignUpData = {
        email: data?.email ?? `test-user-${timestamp}-${userCounter}@example.com`,
        password: data?.password ?? 'TestPassword123!',
        name: data?.name ?? `Test User ${userCounter}`,
      }

      // Sign up
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: defaultData,
      })

      if (!signUpResponse.ok()) {
        const errorData = await signUpResponse.json().catch(() => ({}))
        throw new Error(
          `Sign up failed with status ${signUpResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      // Sign in (to set cookies)
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: defaultData.email,
          password: defaultData.password,
        },
      })

      if (!signInResponse.ok()) {
        const errorData = await signInResponse.json().catch(() => ({}))
        throw new Error(
          `Sign in failed with status ${signInResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await signInResponse.json()
      return {
        user: result.user,
        session: result.session,
        token: result.session?.token, // Convenience alias
      }
    })
  },

  // Auth fixture: Create and authenticate an admin user
  // Creates user, updates role to admin via executeQuery, then signs in
  createAuthenticatedAdmin: async ({ page }, use, testInfo) => {
    let userCounter = 0

    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      userCounter++
      const timestamp = Date.now()
      const defaultData: SignUpData = {
        email: data?.email ?? `admin-${timestamp}-${userCounter}@example.com`,
        password: data?.password ?? 'AdminPassword123!',
        name: data?.name ?? `Admin User ${userCounter}`,
      }

      // Sign up
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: defaultData,
      })

      if (!signUpResponse.ok()) {
        const errorData = await signUpResponse.json().catch(() => ({}))
        throw new Error(
          `Admin sign up failed with status ${signUpResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const signUpResult = await signUpResponse.json()
      const userId = signUpResult.user?.id

      if (!userId) {
        throw new Error('Failed to get user ID from sign up response')
      }

      // Update user role to admin via database
      const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
      if (!connectionUrl) {
        throw new Error('Database not initialized for admin role update')
      }

      const testDbName = (testInfo as any)._testDatabaseName
      if (testDbName) {
        const { Client } = await import('pg')
        const url = new URL(connectionUrl)
        const pathParts = url.pathname.split('/')
        pathParts[1] = testDbName
        url.pathname = pathParts.join('/')

        const client = new Client({ connectionString: url.toString() })
        await client.connect()
        try {
          await client.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [userId])
        } finally {
          await client.end()
        }
      }

      // Sign in (to set cookies with updated role)
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: defaultData.email,
          password: defaultData.password,
        },
      })

      if (!signInResponse.ok()) {
        const errorData = await signInResponse.json().catch(() => ({}))
        throw new Error(
          `Admin sign in failed with status ${signInResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await signInResponse.json()
      return {
        user: { ...result.user, role: 'admin' },
        session: result.session,
        token: result.session?.token, // Convenience alias
      }
    })
  },

  // Auth fixture: Create and authenticate a viewer user
  // Creates user, updates role to viewer via executeQuery, then signs in
  createAuthenticatedViewer: async ({ page }, use, testInfo) => {
    let userCounter = 0

    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      userCounter++
      const timestamp = Date.now()
      const defaultData: SignUpData = {
        email: data?.email ?? `viewer-${timestamp}-${userCounter}@example.com`,
        password: data?.password ?? 'ViewerPassword123!',
        name: data?.name ?? `Viewer User ${userCounter}`,
      }

      // Sign up
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: defaultData,
      })

      if (!signUpResponse.ok()) {
        const errorData = await signUpResponse.json().catch(() => ({}))
        throw new Error(
          `Viewer sign up failed with status ${signUpResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const signUpResult = await signUpResponse.json()
      const userId = signUpResult.user?.id

      if (!userId) {
        throw new Error('Failed to get user ID from sign up response')
      }

      // Update user role to viewer via database
      const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
      if (!connectionUrl) {
        throw new Error('Database not initialized for viewer role update')
      }

      const testDbName = (testInfo as any)._testDatabaseName
      if (testDbName) {
        const { Client } = await import('pg')
        const url = new URL(connectionUrl)
        const pathParts = url.pathname.split('/')
        pathParts[1] = testDbName
        url.pathname = pathParts.join('/')

        const client = new Client({ connectionString: url.toString() })
        await client.connect()
        try {
          await client.query(`UPDATE "user" SET role = 'viewer' WHERE id = $1`, [userId])
        } finally {
          await client.end()
        }
      }

      // Sign in (to set cookies with updated role)
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: defaultData.email,
          password: defaultData.password,
        },
      })

      if (!signInResponse.ok()) {
        const errorData = await signInResponse.json().catch(() => ({}))
        throw new Error(
          `Viewer sign in failed with status ${signInResponse.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await signInResponse.json()
      return {
        user: { ...result.user, role: 'viewer' },
        session: result.session,
        token: result.session?.token, // Convenience alias
      }
    })
  },

  // Organization fixture: Create a new organization via API
  createOrganization: async ({ page }, use) => {
    await use(async (data: { name: string; slug?: string }): Promise<OrganizationResult> => {
      const response = await page.request.post('/api/auth/organization/create-organization', {
        data: {
          name: data.name,
          ...(data.slug && { slug: data.slug }),
        },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Create organization failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  // Organization fixture: Invite a member to an organization via API
  inviteMember: async ({ page }, use) => {
    await use(
      async (data: {
        organizationId: string
        email: string
        role?: 'admin' | 'member'
      }): Promise<InvitationResult> => {
        const response = await page.request.post('/api/auth/organization/invite-member', {
          data: {
            organizationId: data.organizationId,
            email: data.email,
            role: data.role ?? 'member',
          },
        })

        if (!response.ok()) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Invite member failed with status ${response.status()}: ${JSON.stringify(errorData)}`
          )
        }

        return response.json()
      }
    )
  },

  // Organization fixture: Accept an invitation via API
  acceptInvitation: async ({ page }, use) => {
    await use(async (invitationId: string): Promise<MembershipResult> => {
      const response = await page.request.post('/api/auth/organization/accept-invitation', {
        data: {
          invitationId,
        },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Accept invitation failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  // Organization fixture: Add a member directly to an organization via API
  addMember: async ({ page }, use) => {
    await use(
      async (data: {
        organizationId: string
        userId: string
        role?: 'admin' | 'member'
      }): Promise<MembershipResult> => {
        const response = await page.request.post('/api/auth/organization/add-member', {
          data: {
            organizationId: data.organizationId,
            userId: data.userId,
            role: data.role ?? 'member',
          },
        })

        if (!response.ok()) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Add member failed with status ${response.status()}: ${JSON.stringify(errorData)}`
          )
        }

        return response.json()
      }
    )
  },

  // Mailpit fixture: Email testing helper
  // Each test gets its own isolated namespace via unique testId
  // No need to clear emails - filtering by testId provides isolation
  mailpit: async ({}, use) => {
    const testId = generateTestId()
    const mailpit = new MailpitHelper({ testId })

    await use(mailpit)
  },
})

export { expect } from '@playwright/test'
export type { Locator } from '@playwright/test'
export type { MailpitEmail } from './email-utils'

// =============================================================================
// Multi-Org Test Utilities
// =============================================================================

/**
 * Type for executeQuery function (used for helper function signatures)
 */
export type ExecuteQueryFn = (
  sql: string | string[],
  params?: unknown[]
) => Promise<{
  rows: any[]
  rowCount: number
  [key: string]: any
}>

/**
 * Verify that a record exists in the database
 *
 * @example
 * ```ts
 * // Check if record exists
 * const exists = await verifyRecordExists(
 *   executeQuery,
 *   'employees',
 *   { id: 1, organization_id: 'org_123' }
 * )
 * expect(exists).toBe(true)
 * ```
 */
export async function verifyRecordExists(
  executeQuery: ExecuteQueryFn,
  table: string,
  conditions: Record<string, unknown>
): Promise<boolean> {
  const keys = Object.keys(conditions)
  const whereClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ')
  const values = keys.map((key) => conditions[key])

  const result = await executeQuery(
    `SELECT COUNT(*) as count FROM "${table}" WHERE ${whereClause}`,
    values
  )
  return result.rows[0]?.count > 0
}

/**
 * Verify that a record does NOT exist in the database
 *
 * @example
 * ```ts
 * // Check if record was deleted
 * const notExists = await verifyRecordNotExists(
 *   executeQuery,
 *   'employees',
 *   { id: 1 }
 * )
 * expect(notExists).toBe(true)
 * ```
 */
export async function verifyRecordNotExists(
  executeQuery: ExecuteQueryFn,
  table: string,
  conditions: Record<string, unknown>
): Promise<boolean> {
  const exists = await verifyRecordExists(executeQuery, table, conditions)
  return !exists
}

/**
 * Result from createMultiOrgScenario
 */
export interface MultiOrgScenarioResult {
  userOrgRecordIds: number[]
  otherOrgRecordIds: number[]
}

/**
 * Create a test scenario with records in multiple organizations
 * Useful for testing organization isolation and cross-org access prevention
 *
 * @example
 * ```ts
 * // Create records in two organizations
 * const { userOrgRecordIds, otherOrgRecordIds } = await createMultiOrgScenario(
 *   executeQuery,
 *   {
 *     table: 'employees',
 *     organizationIdField: 'organization_id',
 *     userOrgId: 'org_123',
 *     otherOrgId: 'org_456',
 *     userOrgRecords: [
 *       { name: 'Alice', email: 'alice@example.com' },
 *       { name: 'Bob', email: 'bob@example.com' },
 *     ],
 *     otherOrgRecords: [
 *       { name: 'Charlie', email: 'charlie@example.com' },
 *     ],
 *   }
 * )
 *
 * // userOrgRecordIds = [1, 2] (IDs of Alice and Bob)
 * // otherOrgRecordIds = [3] (ID of Charlie)
 * ```
 */
export async function createMultiOrgScenario(
  executeQuery: ExecuteQueryFn,
  options: {
    table: string
    organizationIdField?: string
    userOrgId: string
    otherOrgId: string
    userOrgRecords: Record<string, unknown>[]
    otherOrgRecords: Record<string, unknown>[]
  }
): Promise<MultiOrgScenarioResult> {
  const {
    table,
    organizationIdField = 'organization_id',
    userOrgId,
    otherOrgId,
    userOrgRecords,
    otherOrgRecords,
  } = options

  const userOrgRecordIds: number[] = []
  const otherOrgRecordIds: number[] = []

  // Insert user org records
  for (const record of userOrgRecords) {
    const recordWithOrg = { ...record, [organizationIdField]: userOrgId }
    const keys = Object.keys(recordWithOrg)
    const columns = keys.map((k) => `"${k}"`).join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const values = keys.map((k) => recordWithOrg[k])

    const result = await executeQuery(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING id`,
      values
    )
    if (result.rows[0]?.id) {
      userOrgRecordIds.push(result.rows[0].id)
    }
  }

  // Insert other org records
  for (const record of otherOrgRecords) {
    const recordWithOrg = { ...record, [organizationIdField]: otherOrgId }
    const keys = Object.keys(recordWithOrg)
    const columns = keys.map((k) => `"${k}"`).join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const values = keys.map((k) => recordWithOrg[k])

    const result = await executeQuery(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING id`,
      values
    )
    if (result.rows[0]?.id) {
      otherOrgRecordIds.push(result.rows[0].id)
    }
  }

  return { userOrgRecordIds, otherOrgRecordIds }
}
