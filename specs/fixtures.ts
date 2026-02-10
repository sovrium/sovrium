/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from '@playwright/test'
import { createTempConfigFile, cleanupTempConfigFile } from './fixtures/cli'
import { MailpitHelper, generateTestId } from './fixtures/email'
import {
  getTemplateManager,
  startCliServer,
  stopServer,
  generateTestDatabaseName,
} from './fixtures/server'
import type { DatabaseTemplateManager } from './fixtures/database'
import type {
  ServerFixtures,
  AuthResult,
  SignUpData,
  SignInData,
  ApiKeyResult,
  ApiKeyCreateData,
  ApiKey,
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
  AdminCreateUserData,
  AdminUserResult,
} from './fixtures/types'
import type { App } from '@/domain/models/app'
import type { ChildProcess } from 'node:child_process'

/**
 * Playwright test fixtures with CLI server, database isolation, and auth helpers
 *
 * Features:
 * - Automatic server lifecycle: starts server with app schema, cleans up on test end
 * - Database isolation: each test gets a fresh database cloned from template
 * - Request auto-configuration: page.request methods auto-prepend serverUrl
 * - Auth fixtures: signUp, signIn, createAuthenticatedUser with session management
 * - Email testing: integrated Mailpit for email verification
 * - Analytics mocking: blocks external analytics to prevent flakiness
 *
 * @example Basic usage
 * ```typescript
 * import { test, expect } from '@/specs/fixtures'
 *
 * test('should display home page', async ({ startServerWithSchema, page }) => {
 *   await startServerWithSchema({ name: 'my-app', tables: [...] })
 *   await page.goto('/')
 *   await expect(page).toHaveTitle(/My App/)
 * })
 * ```
 *
 * @example With authentication
 * ```typescript
 * test('should access protected route', async ({ startServerWithSchema, page, createAuthenticatedUser }) => {
 *   await startServerWithSchema({ name: 'my-app', tables: [...] })
 *   await createAuthenticatedUser({ email: 'test@example.com', password: 'test123', name: 'Test' })
 *   await page.goto('/dashboard')
 *   await expect(page.getByText('Welcome')).toBeVisible()
 * })
 * ```
 *
 * @example With database queries
 * ```typescript
 * test('should insert data', async ({ startServerWithSchema, executeQuery }) => {
 *   await startServerWithSchema({ name: 'my-app', tables: [...] })
 *   await executeQuery("INSERT INTO users (name) VALUES ('Alice')")
 *   const result = await executeQuery("SELECT * FROM users")
 *   expect(result.rows).toHaveLength(1)
 * })
 * ```
 *
 * Notes:
 * - Analytics mocking is enabled by default (Google, Plausible, Matomo, etc.)
 *   - Prevents flakiness from external script loading
 *   - Disable with: test.use({ mockAnalytics: false })
 * - Server and database are automatically cleaned up after test completion
 * - Configures baseURL for relative navigation with page.goto('/')
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

  // Request fixture: Alias to page.request for convenience
  // This provides the same APIRequestContext as page.request but as a standalone fixture
  // Automatically configured with serverUrl and authentication after startServerWithSchema
  // The actual URL resolution is handled by page.request overrides in startServerWithSchema
  request: async ({ page }, use) => {
    await use(page.request)
  },

  // Server fixture: Start server with custom schema and optional database
  startServerWithSchema: async ({ page }, use, testInfo) => {
    let serverProcess: ChildProcess | null = null
    let serverUrl = ''
    let testDbName: string | null = null

    // Provide function to start server with custom schema
    await use(
      async (
        appSchema: App,
        options?: {
          useDatabase?: boolean
          database?: { url?: string }
          adminBootstrap?: {
            email?: string
            password?: string
            name?: string
          }
        }
      ) => {
        let databaseUrl: string | undefined = undefined

        // Use custom database URL if provided
        if (options?.database?.url) {
          databaseUrl = options.database.url
        } else if (options?.useDatabase !== false) {
          // Enable database by default (can be disabled with useDatabase: false)
          // Check if database was already initialized by executeQuery
          const existingDbName = (testInfo as any)._testDatabaseName
          if (existingDbName) {
            // Database already created by executeQuery - reuse it
            testDbName = existingDbName as string
            const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
            if (!connectionUrl) {
              throw new Error('Database container not initialized')
            }
            // Construct the database URL from the existing database name
            const url = new URL(connectionUrl)
            const pathParts = url.pathname.split('/')
            pathParts[1] = existingDbName as string
            url.pathname = pathParts.join('/')
            databaseUrl = url.toString()
          } else {
            // Database not yet created - create it now
            const templateManager = await getTemplateManager()
            testDbName = generateTestDatabaseName(testInfo)
            databaseUrl = await templateManager.duplicateTemplate(testDbName)
            // Store database name for executeQuery fixture to use
            ;(testInfo as any)._testDatabaseName = testDbName
          }
        }

        // Stop previous server if it exists (for tests that call startServerWithSchema multiple times)
        if (serverProcess) {
          await stopServer(serverProcess)
          serverProcess = null
        }

        // SMTP is automatically configured via environment variables from mailpit
        // (configured in startCliServer - no need to pass email config in schema)
        const server = await startCliServer(appSchema, databaseUrl, options?.adminBootstrap)
        serverProcess = server.process
        serverUrl = server.url

        // Store serverUrl in testInfo for request fixture to access
        ;(testInfo as any)._serverUrl = serverUrl

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

        const originalDelete = page.request.delete.bind(page.request)
        const originalPatch = page.request.patch.bind(page.request)

        page.request.post = (urlOrRequest, options?) => {
          const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
          const fullUrl =
            typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
          return originalPost(fullUrl, options)
        }

        page.request.get = (urlOrRequest, options?) => {
          const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
          const fullUrl =
            typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
          return originalGet(fullUrl, options)
        }

        page.request.put = (urlOrRequest, options?) => {
          const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
          const fullUrl =
            typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
          return originalPut(fullUrl, options)
        }

        page.request.delete = (urlOrRequest, options?) => {
          const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
          const fullUrl =
            typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
          return originalDelete(fullUrl, options)
        }

        page.request.patch = (urlOrRequest, options?) => {
          const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
          const fullUrl =
            typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
          return originalPatch(fullUrl, options)
        }
      }
    )

    // Cleanup after test
    if (serverProcess) {
      await stopServer(serverProcess)
    }
    // Drop test database to reclaim resources
    if (testDbName) {
      const templateManager = await getTemplateManager()
      await templateManager.dropTestDatabase(testDbName)
    }
  },

  // Database query fixture with lazy initialization
  executeQuery: async ({}, use, testInfo) => {
    let testDbName: string | null = null
    let templateManager: DatabaseTemplateManager | null = null
    let databaseUrl: string | null = null

    // Provide query function to test
    await use(async (sql, params) => {
      // Lazy initialization: create database on first query
      if (!databaseUrl) {
        // Check if database was already initialized by startServerWithSchema
        const existingDbName = (testInfo as any)._testDatabaseName
        if (existingDbName) {
          // Database already created - construct URL
          testDbName = existingDbName as string
          const connectionUrl = process.env.TEST_DATABASE_CONTAINER_URL
          if (!connectionUrl) {
            throw new Error('Database container not initialized')
          }
          const url = new URL(connectionUrl)
          const pathParts = url.pathname.split('/')
          pathParts[1] = existingDbName as string
          url.pathname = pathParts.join('/')
          databaseUrl = url.toString()
        } else {
          // First query - create database
          templateManager = await getTemplateManager()
          testDbName = generateTestDatabaseName(testInfo)
          databaseUrl = await templateManager.duplicateTemplate(testDbName)
          // Store for startServerWithSchema to reuse
          ;(testInfo as any)._testDatabaseName = testDbName
        }
      }

      // Import pg dynamically
      const pg = await import('pg')
      const client = new pg.default.Client({ connectionString: databaseUrl })
      await client.connect()

      try {
        // Execute single query or multiple statements
        if (Array.isArray(sql)) {
          // Multiple statements - execute in a transaction to support SET LOCAL
          await client.query('BEGIN')
          try {
            let result: any = { rows: [], rowCount: 0 }
            for (const statement of sql) {
              result = await client.query(statement, params)
            }
            await client.query('COMMIT')

            // Note: PostgreSQL returns DECIMAL/NUMERIC as strings, but we keep them as-is
            // for test assertions to work correctly (tests expect string values)
            const parsedRows = result.rows

            // Apply single-row spreading logic for transaction results too
            if (parsedRows.length === 1) {
              return {
                ...parsedRows[0],
                rows: parsedRows,
                rowCount: result.rowCount ?? parsedRows.length,
              }
            }

            return {
              rows: parsedRows,
              rowCount: result.rowCount ?? parsedRows.length,
            }
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          }
        }

        const result = await client.query(sql, params)

        // Note: PostgreSQL returns DECIMAL/NUMERIC as strings, but we keep them as-is
        // for test assertions to work correctly (tests expect string values)
        const parsedRows = result.rows ?? []

        // Return result with convenient properties
        // For single-row results, spread the row properties for easier access
        if (parsedRows.length === 1) {
          return {
            ...parsedRows[0],
            rows: parsedRows,
            rowCount: result.rowCount ?? parsedRows.length,
          }
        }

        return {
          rows: parsedRows,
          rowCount: result.rowCount ?? parsedRows.length,
        }
      } finally {
        await client.end()
      }
    })

    // Cleanup: drop test database if created directly by executeQuery
    // (not if it was already created by startServerWithSchema)
    if (testDbName && templateManager) {
      await (templateManager as DatabaseTemplateManager).dropTestDatabase(testDbName)
    }
  },

  // Static site generation fixture
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
          APP_SCHEMA: JSON.stringify(appSchema),
          SOVRIUM_OUTPUT_DIR: outputDir,
        } as Record<string, string>

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
        const { spawn } = await import('node:child_process')
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('bun', ['run', 'src/cli.ts', 'build'], {
            env,
            stdio: 'pipe',
          })

          const outputBuffer: string[] = []

          proc.stdout?.on('data', (data) => {
            outputBuffer.push(data.toString())
          })

          proc.stderr?.on('data', (data) => {
            outputBuffer.push(data.toString())
          })

          proc.on('exit', (code) => {
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

          proc.on('error', (error) => {
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

  /**
   * Start CLI server with a config file (JSON or YAML)
   *
   * This fixture handles:
   * - Creating a temporary config file
   * - Starting the CLI server with the config
   * - Database initialization if needed
   * - Automatic cleanup on test end
   *
   * @example JSON config
   * ```typescript
   * test('should load JSON config', async ({ startCliServerWithConfig, page }) => {
   *   const server = await startCliServerWithConfig({
   *     config: { name: 'my-app', tables: [...] },
   *     format: 'json'
   *   })
   *   await page.goto(server.url)
   * })
   * ```
   *
   * @example YAML config
   * ```typescript
   * test('should load YAML config', async ({ startCliServerWithConfig, page }) => {
   *   const server = await startCliServerWithConfig({
   *     config: 'name: my-app\ntables: []',
   *     format: 'yaml'
   *   })
   * })
   * ```
   */
  startCliServerWithConfig: async ({ page }, use, testInfo) => {
    // Use container pattern to avoid TypeScript closure narrowing issues
    const state: { cleanup: (() => Promise<void>) | null } = { cleanup: null }

    await use(async (options) => {
      // Prepare config content
      const content =
        typeof options.config === 'string' ? options.config : JSON.stringify(options.config)

      // Create temp config file
      const configPath = await createTempConfigFile(content, options.format)

      // Prepare database URL if needed
      let databaseUrl = options.databaseUrl
      let testDbName: string | null = null
      let templateManager: Awaited<ReturnType<typeof getTemplateManager>> | null = null

      if (!databaseUrl) {
        // Create isolated test database
        templateManager = await getTemplateManager()
        testDbName = generateTestDatabaseName(testInfo)
        databaseUrl = await templateManager.duplicateTemplate(testDbName)
        ;(testInfo as any)._testDatabaseName = testDbName
      }

      // Start CLI server with config file
      const { spawn } = await import('node:child_process')
      const { MailpitHelper: MH } = await import('./fixtures/email')
      const mailpit = new MH()
      const smtpEnv = mailpit.getSmtpEnv('noreply@sovrium.com', { fromName: 'Sovrium' })

      const serverProcess = spawn('bun', ['run', 'src/cli.ts', 'start', configPath], {
        env: {
          ...process.env,
          PORT: options.port?.toString() || '0',
          ...(options.hostname && { HOSTNAME: options.hostname }),
          DATABASE_URL: databaseUrl,
          ...smtpEnv,
          AUTH_SECRET: 'test-secret-for-e2e-testing-32chars',
          RATE_LIMIT_WINDOW_SECONDS: '5', // Fast rate limit windows for tests (5s instead of 60s production default)
        },
        stdio: 'pipe',
      })

      // Wait for server to be ready
      const port = await new Promise<number>((resolve, reject) => {
        const outputBuffer: string[] = []
        let attempts = 0
        const maxAttempts = 50

        const checkOutput = (data: Buffer) => {
          const output = data.toString()
          outputBuffer.push(output)
          const match = output.match(/Homepage: http:\/\/localhost:(\d+)/)
          if (match?.[1]) {
            resolve(parseInt(match[1], 10))
          }
        }

        serverProcess.stdout?.on('data', checkOutput)
        serverProcess.stderr?.on('data', checkOutput)

        serverProcess.on('error', (error) => {
          reject(new Error(`Failed to start server: ${error.message}`))
        })

        const interval = setInterval(() => {
          attempts++
          if (attempts >= maxAttempts) {
            clearInterval(interval)
            reject(new Error(`Server did not start. Output: ${outputBuffer.join('\n')}`))
          }
        }, 100)

        serverProcess.once('exit', () => {
          clearInterval(interval)
          reject(new Error(`Server exited. Output: ${outputBuffer.join('\n')}`))
        })
      })

      const serverUrl = `http://localhost:${port}`

      // Store serverUrl in testInfo for other fixtures
      ;(testInfo as any)._serverUrl = serverUrl

      // Configure page.goto and page.request like startServerWithSchema
      // @ts-expect-error - Setting baseURL for assertions
      page._browserContext._options.baseURL = serverUrl

      const originalGoto = page.goto.bind(page)
      page.goto = (url: string, opts?: Parameters<typeof page.goto>[1]) => {
        const fullUrl = url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalGoto(fullUrl, opts)
      }

      // Override page.request methods
      const originalPost = page.request.post.bind(page.request)
      const originalGet = page.request.get.bind(page.request)
      page.request.post = (urlOrRequest, opts?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalPost(fullUrl, opts)
      }
      page.request.get = (urlOrRequest, opts?) => {
        const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest
        const fullUrl = typeof url === 'string' && url.startsWith('/') ? `${serverUrl}${url}` : url
        return originalGet(fullUrl, opts)
      }

      // Set up cleanup function
      state.cleanup = async () => {
        await stopServer(serverProcess)
        await cleanupTempConfigFile(configPath)
        if (testDbName && templateManager) {
          await templateManager.dropTestDatabase(testDbName)
        }
      }

      return { url: serverUrl, port }
    })

    // Cleanup
    if (state.cleanup) {
      await state.cleanup()
    }
  },

  // Auth fixtures
  signUp: async ({ page }, use, testInfo) => {
    await use(async (data: SignUpData): Promise<AuthResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

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

      // Better Auth returns { user, token } directly, not { user, session }
      // Construct session object from the token for AuthResult compatibility
      return {
        user: result.user,
        session: result.token
          ? {
              id: '', // Not provided by Better Auth sign-up response
              userId: result.user.id,
              token: result.token,
              expiresAt: '', // Not provided by Better Auth sign-up response
            }
          : undefined,
        token: result.token,
      }
    })
  },

  signIn: async ({ page }, use, testInfo) => {
    await use(async (data: SignInData): Promise<AuthResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe ?? false,
        },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Sign in failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await response.json()

      // Better Auth returns { user, token } directly, not { user, session }
      // Construct session object from the token for AuthResult compatibility
      return {
        user: result.user,
        session: result.token
          ? {
              id: '', // Not provided by Better Auth sign-in response
              userId: result.user.id,
              token: result.token,
              expiresAt: '', // Not provided by Better Auth sign-in response
            }
          : undefined,
        token: result.token,
      }
    })
  },

  signOut: async ({ page }, use, testInfo) => {
    await use(async (): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/sign-out')

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Sign out failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  createAuthenticatedUser: async ({ signUp, signIn }, use) => {
    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      const testId = generateTestId()
      const userData: SignUpData = {
        email: data?.email || `test-${testId}@example.com`,
        password: data?.password || 'TestPassword123!',
        name: data?.name || `Test User ${testId}`,
      }

      // Sign up the user
      await signUp(userData)

      // Sign in to get session cookies
      const signInResult = await signIn({
        email: userData.email,
        password: userData.password,
      })

      return signInResult
    })
  },

  createAuthenticatedAdmin: async (
    { createAuthenticatedUser, page, signIn, executeQuery },
    use,
    testInfo
  ) => {
    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      // Create user first
      const user = await createAuthenticatedUser(data)

      // Set role to admin via direct database update
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started.')
      }

      // Try admin API first (requires existing admin user)
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: user.user.id,
          role: 'admin',
        },
      })

      // If admin API is not available (403 = first user, no admin exists yet), use direct database update
      if (response.status() === 403) {
        // Fallback: Direct database update for first user scenario
        await executeQuery(`UPDATE auth.user SET role = 'admin' WHERE id = $1`, [user.user.id])

        // Return the user with updated role (no need to re-authenticate, session still valid)
        return { ...user, user: { ...user.user, role: 'admin' } }
      }

      // If other error, throw
      if (!response.ok()) {
        throw new Error(
          `Admin API endpoint failed (status: ${response.status()}). ` +
            `To use createAuthenticatedAdmin, configure Better Auth admin plugin in your test schema. ` +
            `Alternative: use createAuthenticatedUser() and set role manually via executeQuery()`
        )
      }

      // Re-authenticate after session revocation (set-role revokes all sessions when it succeeds)
      const testId = data?.email || user.user.email
      const password = data?.password || 'TestPassword123!'
      const signInResult = await signIn({ email: testId, password })

      return signInResult
    })
  },

  createAuthenticatedViewer: async (
    { createAuthenticatedUser, page, signIn, executeQuery },
    use,
    testInfo
  ) => {
    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      // Create user first
      const user = await createAuthenticatedUser(data)

      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started.')
      }

      // Try admin API first (requires Better Auth admin plugin)
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: user.user.id,
          role: 'viewer',
        },
      })

      if (!response.ok()) {
        // Fallback: Direct database update if admin API not available
        await executeQuery(`UPDATE auth.user SET role = 'viewer' WHERE id = $1`, [user.user.id])
      }

      // Re-authenticate after role change (set-role API revokes all sessions)
      const testId = data?.email || user.user.email
      const password = data?.password || 'TestPassword123!'
      const signInResult = await signIn({ email: testId, password })

      return signInResult
    })
  },

  createAuthenticatedMember: async (
    { createAuthenticatedUser, executeQuery, signIn },
    use,
    _testInfo
  ) => {
    await use(async (data?: Partial<SignUpData>): Promise<AuthResult> => {
      // Create user first
      const user = await createAuthenticatedUser(data)

      // Set role to member using direct database update
      await executeQuery(`UPDATE auth.user SET role = 'member' WHERE id = $1`, [user.user.id])

      // Re-authenticate to get session with updated role
      const testId = data?.email || user.user.email
      const password = data?.password || 'TestPassword123!'
      const signInResult = await signIn({ email: testId, password })

      return signInResult
    })
  },

  // Email testing fixture
  mailpit: async ({}, use) => {
    const testId = generateTestId()
    const mailpit = new MailpitHelper({ testId })

    // Clear mailbox at start of test
    await mailpit.clearEmails()

    await use(mailpit)
  },

  // API Key fixtures
  createApiKey: async ({ page }, use, testInfo) => {
    await use(async (data?: ApiKeyCreateData): Promise<ApiKeyResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/api-key/create', {
        data: data || {},
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Create API key failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  listApiKeys: async ({ page }, use, testInfo) => {
    await use(async (): Promise<ApiKey[]> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.get('/api/auth/api-key/list')

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `List API keys failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  deleteApiKey: async ({ page }, use, testInfo) => {
    await use(async (keyId: string): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.delete(`/api/auth/api-key/${keyId}`)

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Delete API key failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  createApiKeyAuth: async ({ createApiKey }, use) => {
    await use(async (data?: ApiKeyCreateData): Promise<{ headers: { Authorization: string } }> => {
      const apiKey = await createApiKey(data)
      return {
        headers: {
          Authorization: `Bearer ${apiKey.key}`,
        },
      }
    })
  },

  // Two-Factor fixtures
  enableTwoFactor: async ({ page }, use, testInfo) => {
    await use(async (): Promise<TwoFactorSetupResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/two-factor/enable')

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Enable 2FA failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  verifyTwoFactor: async ({ page }, use, testInfo) => {
    await use(async (code: string): Promise<TwoFactorVerifyResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/two-factor/verify', {
        data: { code },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Verify 2FA failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      return response.json()
    })
  },

  disableTwoFactor: async ({ page }, use, testInfo) => {
    await use(async (code: string): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/two-factor/disable', {
        data: { code },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Disable 2FA failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  generateTotpCode: async ({}, use) => {
    await use((secret: string): string => {
      // TOTP implementation using HMAC-SHA1
      const epoch = Math.floor(Date.now() / 1000)
      const timeStep = 30
      const counter = Math.floor(epoch / timeStep)

      // Convert counter to 8-byte buffer
      const counterBuffer = Buffer.alloc(8)
      counterBuffer.writeBigUInt64BE(BigInt(counter))

      // Decode base32 secret
      const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      let bits = ''
      for (const char of secret.toUpperCase().replace(/=+$/, '')) {
        const val = base32Chars.indexOf(char)
        if (val === -1) continue
        bits += val.toString(2).padStart(5, '0')
      }
      const secretBuffer = Buffer.alloc(Math.floor(bits.length / 8))
      for (let i = 0; i < secretBuffer.length; i++) {
        secretBuffer[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
      }

      // Generate HMAC
      const hmac = createHmac('sha1', secretBuffer)
      hmac.update(counterBuffer)
      const hash = hmac.digest()

      // Dynamic truncation
      const offset = hash[hash.length - 1]! & 0x0f
      const binary =
        ((hash[offset]! & 0x7f) << 24) |
        ((hash[offset + 1]! & 0xff) << 16) |
        ((hash[offset + 2]! & 0xff) << 8) |
        (hash[offset + 3]! & 0xff)

      const otp = binary % 1_000_000
      return otp.toString().padStart(6, '0')
    })
  },

  // Admin fixtures
  adminCreateUser: async ({ page }, use, testInfo) => {
    await use(async (data: AdminCreateUserData): Promise<AdminUserResult> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/admin/create-user', {
        data,
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Admin create user failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }

      const result = await response.json()
      return { user: result }
    })
  },

  adminBanUser: async ({ page }, use, testInfo) => {
    await use(async (userId: string): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: { userId },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Admin ban user failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  adminUnbanUser: async ({ page }, use, testInfo) => {
    await use(async (userId: string): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/admin/unban-user', {
        data: { userId },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Admin unban user failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },

  adminListUsers: async ({ page }, use, testInfo) => {
    await use(
      async (filters?: {
        search?: string
        role?: string
        banned?: boolean
      }): Promise<{ users: any[] }> => {
        const serverUrl = (testInfo as any)._serverUrl
        if (!serverUrl) {
          throw new Error('Server not started. Call startServerWithSchema first.')
        }

        const params = new URLSearchParams()
        if (filters?.search) params.set('search', filters.search)
        if (filters?.role) params.set('role', filters.role)
        if (filters?.banned !== undefined) params.set('banned', String(filters.banned))

        const response = await page.request.get(`/api/auth/admin/list-users?${params}`)

        if (!response.ok()) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Admin list users failed with status ${response.status()}: ${JSON.stringify(errorData)}`
          )
        }

        return response.json()
      }
    )
  },

  adminSetRole: async ({ page }, use, testInfo) => {
    await use(async (userId: string, role: string): Promise<void> => {
      const serverUrl = (testInfo as any)._serverUrl
      if (!serverUrl) {
        throw new Error('Server not started. Call startServerWithSchema first.')
      }

      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId, role },
      })

      if (!response.ok()) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Admin set role failed with status ${response.status()}: ${JSON.stringify(errorData)}`
        )
      }
    })
  },
})

// Re-export Playwright essentials
export { expect } from '@playwright/test'
export type { Locator } from '@playwright/test'

// Re-export from modular files
export type { MailpitEmail } from './fixtures/email'
export {
  initializeGlobalDatabase,
  cleanupGlobalDatabase,
  killAllServerProcesses,
  startCliServer,
  stopServer,
  getTemplateManager,
  generateTestDatabaseName,
} from './fixtures/server'
export { createTempConfigFile, cleanupTempConfigFile, captureCliOutput } from './fixtures/cli'
export type { CliServerResult, CliOutputResult } from './fixtures/cli'
export {
  splitSQLStatements,
  executeStatementsInTransaction,
  verifyRecordExists,
  verifyRecordNotExists,
} from './fixtures/database'
export type { ExecuteQueryFn } from './fixtures/database'
export type {
  ServerFixtures,
  AuthResult,
  SignUpData,
  SignInData,
  ApiKeyResult,
  ApiKeyCreateData,
  ApiKey,
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
  AdminCreateUserData,
  AdminUserResult,
} from './fixtures/types'
