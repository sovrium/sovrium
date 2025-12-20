/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for CLI Start Command with Environment Variable Schema
 *
 * Source: src/cli.ts
 * Domain: cli
 * Spec Count: 11
 *
 * Environment Variable Behavior:
 * - Loads schema from SOVRIUM_APP_SCHEMA environment variable
 * - Supports inline JSON format
 * - Supports inline YAML format
 * - Supports remote JSON URLs
 * - Supports remote YAML URLs
 * - Auto-detects format from content/headers/extension
 * - File path argument takes precedence over environment variable
 * - Provides clear error messages for invalid inputs
 *
 * Format Detection Priority:
 * 1. If value starts with '{' → JSON
 * 2. If value starts with 'http://' or 'https://' → Fetch URL
 *    - Detect from Content-Type header (application/json vs application/x-yaml)
 *    - Detect from file extension (.json vs .yaml/.yml)
 *    - Fallback: try JSON first, then YAML
 * 3. Otherwise → YAML
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (10 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

/**
 * Helper function to capture CLI output with environment variable
 */
async function captureCliOutputWithEnv(
  env: Record<string, string>,
  args: string[] = []
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'src/cli.ts', 'start', ...args], {
      env: {
        ...process.env,
        ...env,
      },
      stdio: 'pipe',
    })

    const outputBuffer: string[] = []

    proc.stdout?.on('data', (data) => {
      outputBuffer.push(data.toString())
    })

    proc.stderr?.on('data', (data) => {
      outputBuffer.push(data.toString())
    })

    // Kill process after 2 seconds (we only need initialization output)
    setTimeout(() => {
      proc.kill('SIGTERM')
    }, 2000)

    proc.on('exit', (code) => {
      resolve({
        output: outputBuffer.join(''),
        exitCode: code ?? 1,
      })
    })
  })
}

/**
 * Helper function to create a mock HTTP server for URL tests
 */
async function createMockHttpServer(
  content: string,
  contentType: string
): Promise<{ url: string; cleanup: () => Promise<void> }> {
  const http = await import('node:http')

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  })

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server address')
  }

  return {
    url: `http://localhost:${address.port}/schema`,
    cleanup: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}

test.describe('CLI Start Command - Environment Variable Schema', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-START-ENV-001: should load inline JSON from SOVRIUM_APP_SCHEMA environment variable',
    { tag: '@spec' },
    async () => {
      // GIVEN: SOVRIUM_APP_SCHEMA with inline JSON string
      const jsonSchema = JSON.stringify({
        name: 'env-json-app',
        description: 'App loaded from inline JSON in environment variable',
      })

      // WHEN: Starting server without file path argument (using env var only)
      const result = await captureCliOutputWithEnv({
        SOVRIUM_APP_SCHEMA: jsonSchema,
        PORT: '0', // Auto-select port
      })

      // THEN: Server starts successfully with schema from environment variable
      expect(result.output).toContain('Starting Sovrium server')
      expect(result.output).toContain('env-json-app')
      expect(result.output).toContain('App loaded from inline JSON in environment variable')
      expect(result.output).toContain('Homepage: http://localhost:')
    }
  )

  test(
    'CLI-START-ENV-002: should load inline YAML from SOVRIUM_APP_SCHEMA environment variable',
    { tag: '@spec' },
    async () => {
      // GIVEN: SOVRIUM_APP_SCHEMA with inline YAML string
      const yamlSchema = `
name: env-yaml-app
description: App loaded from inline YAML in environment variable
version: 1.0.0
`

      // WHEN: Starting server without file path argument (using env var only)
      const result = await captureCliOutputWithEnv({
        SOVRIUM_APP_SCHEMA: yamlSchema,
        PORT: '0',
      })

      // THEN: Server starts successfully with schema from environment variable
      expect(result.output).toContain('Starting Sovrium server')
      expect(result.output).toContain('env-yaml-app')
      expect(result.output).toContain('App loaded from inline YAML in environment variable')
      expect(result.output).toContain('Homepage: http://localhost:')
    }
  )

  test(
    'CLI-START-ENV-003: should load schema from remote JSON URL',
    { tag: '@spec' },
    async () => {
      // GIVEN: HTTP server serving JSON schema
      const jsonSchema = JSON.stringify({
        name: 'remote-json-app',
        description: 'App loaded from remote JSON URL',
      })

      const mockServer = await createMockHttpServer(jsonSchema, 'application/json')

      try {
        // WHEN: Starting server with URL in SOVRIUM_APP_SCHEMA
        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: mockServer.url,
          PORT: '0',
        })

        // THEN: Server fetches and loads schema from URL
        expect(result.output).toContain('Starting Sovrium server')
        expect(result.output).toContain('remote-json-app')
        expect(result.output).toContain('App loaded from remote JSON URL')
        expect(result.output).toContain('Homepage: http://localhost:')
      } finally {
        await mockServer.cleanup()
      }
    }
  )

  test(
    'CLI-START-ENV-004: should load schema from remote YAML URL',
    { tag: '@spec' },
    async () => {
      // GIVEN: HTTP server serving YAML schema
      const yamlSchema = `
name: remote-yaml-app
description: App loaded from remote YAML URL
version: 2.0.0
`

      const mockServer = await createMockHttpServer(yamlSchema, 'application/x-yaml')

      try {
        // WHEN: Starting server with URL in SOVRIUM_APP_SCHEMA
        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: mockServer.url,
          PORT: '0',
        })

        // THEN: Server fetches and loads schema from URL
        expect(result.output).toContain('Starting Sovrium server')
        expect(result.output).toContain('remote-yaml-app')
        expect(result.output).toContain('App loaded from remote YAML URL')
        expect(result.output).toContain('Homepage: http://localhost:')
      } finally {
        await mockServer.cleanup()
      }
    }
  )

  test(
    'CLI-START-ENV-005: should prioritize file path argument over environment variable',
    { tag: '@spec' },
    async () => {
      // GIVEN: Both file path argument AND SOVRIUM_APP_SCHEMA environment variable
      const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-test-'))
      const configPath = join(tempDir, 'config.json')

      const fileSchema = {
        name: 'file-config-app',
        description: 'App from file (should be used)',
      }

      const envSchema = JSON.stringify({
        name: 'env-config-app',
        description: 'App from environment variable (should be ignored)',
      })

      await writeFile(configPath, JSON.stringify(fileSchema))

      try {
        // WHEN: Starting server with both file path AND environment variable
        const result = await captureCliOutputWithEnv(
          {
            SOVRIUM_APP_SCHEMA: envSchema,
            PORT: '0',
          },
          [configPath]
        )

        // THEN: File path takes precedence (environment variable is ignored)
        expect(result.output).toContain('file-config-app')
        expect(result.output).toContain('App from file (should be used)')
        expect(result.output).not.toContain('env-config-app')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  )

  test(
    'CLI-START-ENV-006: should handle invalid JSON in environment variable with clear error',
    { tag: '@spec' },
    async () => {
      // GIVEN: SOVRIUM_APP_SCHEMA with invalid JSON
      const invalidJson = '{ "name": "test", "invalid": }'

      // WHEN: Attempting to start server with invalid JSON in environment variable
      const result = await captureCliOutputWithEnv({
        SOVRIUM_APP_SCHEMA: invalidJson,
      })

      // THEN: CLI displays error message about invalid JSON
      expect(result.output).toContain('Error')
      expect(result.output.toLowerCase()).toMatch(/invalid|parse|json/)
      expect(result.exitCode).not.toBe(0)
    }
  )

  test(
    'CLI-START-ENV-007: should handle invalid YAML in environment variable with clear error',
    { tag: '@spec' },
    async () => {
      // GIVEN: SOVRIUM_APP_SCHEMA with invalid YAML
      const invalidYaml = `
name: test-app
description: "unclosed quote
version: 1.0.0
`

      // WHEN: Attempting to start server with invalid YAML in environment variable
      const result = await captureCliOutputWithEnv({
        SOVRIUM_APP_SCHEMA: invalidYaml,
      })

      // THEN: CLI displays error message about invalid YAML
      expect(result.output).toContain('Error')
      expect(result.output.toLowerCase()).toMatch(/invalid|parse|yaml/)
      expect(result.exitCode).not.toBe(0)
    }
  )

  test(
    'CLI-START-ENV-008: should handle unreachable URL with clear error message',
    { tag: '@spec' },
    async () => {
      // GIVEN: SOVRIUM_APP_SCHEMA with unreachable URL
      const unreachableUrl = 'http://localhost:99999/nonexistent-schema.json'

      // WHEN: Attempting to start server with unreachable URL
      const result = await captureCliOutputWithEnv({
        SOVRIUM_APP_SCHEMA: unreachableUrl,
      })

      // THEN: CLI displays error message about network failure
      expect(result.output).toContain('Error')
      expect(result.output.toLowerCase()).toMatch(/failed|fetch|connect|network/)
      expect(result.output).toContain(unreachableUrl)
      expect(result.exitCode).not.toBe(0)
    }
  )

  test(
    'CLI-START-ENV-009: should handle URL returning non-schema content with clear error',
    { tag: '@spec' },
    async () => {
      // GIVEN: HTTP server returning HTML instead of schema
      const htmlContent = '<html><body>Not a schema</body></html>'
      const mockServer = await createMockHttpServer(htmlContent, 'text/html')

      try {
        // WHEN: Attempting to start server with URL returning non-schema content
        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: mockServer.url,
        })

        // THEN: CLI displays error message about invalid schema content
        expect(result.output).toContain('Error')
        expect(result.output.toLowerCase()).toMatch(/invalid|schema|parse/)
        expect(result.exitCode).not.toBe(0)
      } finally {
        await mockServer.cleanup()
      }
    }
  )

  test(
    'CLI-START-ENV-010: should auto-detect JSON format from Content-Type header',
    { tag: '@spec' },
    async () => {
      // GIVEN: URL with .schema extension (ambiguous) but application/json Content-Type
      const jsonSchema = JSON.stringify({
        name: 'content-type-json-app',
        description: 'Format detected from Content-Type header',
      })

      const mockServer = await createMockHttpServer(jsonSchema, 'application/json')

      try {
        // WHEN: Starting server with URL (format detected from Content-Type)
        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: mockServer.url,
          PORT: '0',
        })

        // THEN: Server correctly detects JSON format from Content-Type header
        expect(result.output).toContain('Starting Sovrium server')
        expect(result.output).toContain('content-type-json-app')
        expect(result.output).toContain('Format detected from Content-Type header')
      } finally {
        await mockServer.cleanup()
      }
    }
  )

  test(
    'CLI-START-ENV-011: should auto-detect YAML format from file extension in URL',
    { tag: '@spec' },
    async () => {
      // GIVEN: HTTP server serving YAML with .yaml extension in URL path
      const yamlSchema = `
name: extension-yaml-app
description: Format detected from .yaml file extension in URL
version: 3.0.0
`

      const http = await import('node:http')
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`)
        if (url.pathname.endsWith('.yaml')) {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end(yamlSchema)
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve())
      })

      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address')
      }

      const yamlUrl = `http://localhost:${address.port}/config.yaml`

      try {
        // WHEN: Starting server with .yaml URL (format detected from extension)
        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: yamlUrl,
          PORT: '0',
        })

        // THEN: Server correctly detects YAML format from file extension
        expect(result.output).toContain('Starting Sovrium server')
        expect(result.output).toContain('extension-yaml-app')
        expect(result.output).toContain('Format detected from .yaml file extension in URL')
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()))
        })
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'CLI-START-ENV-012: user can start server with environment variable in production workflow',
    { tag: '@regression' },
    async () => {
      await test.step('Load inline JSON schema from environment variable', async () => {
        // Simulate production deployment with environment variable
        const jsonSchema = JSON.stringify({
          name: 'production-app',
          description: 'Production app with environment variable schema',
          version: '1.0.0',
          theme: {
            colors: {
              primary: '#3B82F6',
              secondary: '#10B981',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Production App',
                description: 'Production deployment',
              },
              sections: [
                {
                  type: 'h1',
                  children: ['Welcome to Production'],
                },
                {
                  type: 'p',
                  children: ['This app is configured via environment variable'],
                },
              ],
            },
          ],
        })

        const result = await captureCliOutputWithEnv({
          SOVRIUM_APP_SCHEMA: jsonSchema,
          PORT: '0',
        })

        expect(result.output).toContain('Starting Sovrium server')
        expect(result.output).toContain('production-app')
        expect(result.output).toContain('Homepage: http://localhost:')
      })

      await test.step('Verify file path precedence over environment variable', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-regression-'))
        const configPath = join(tempDir, 'priority-test.json')

        await writeFile(
          configPath,
          JSON.stringify({
            name: 'file-priority-app',
            description: 'File takes precedence',
          })
        )

        try {
          const result = await captureCliOutputWithEnv(
            {
              SOVRIUM_APP_SCHEMA: JSON.stringify({
                name: 'env-ignored',
                description: 'Should be ignored',
              }),
              PORT: '0',
            },
            [configPath]
          )

          expect(result.output).toContain('file-priority-app')
          expect(result.output).not.toContain('env-ignored')
        } finally {
          await rm(tempDir, { recursive: true, force: true })
        }
      })

      await test.step('Verify remote URL schema fetching', async () => {
        const remoteSchema = JSON.stringify({
          name: 'remote-production-app',
          description: 'Fetched from remote URL',
        })

        const mockServer = await createMockHttpServer(remoteSchema, 'application/json')

        try {
          const result = await captureCliOutputWithEnv({
            SOVRIUM_APP_SCHEMA: mockServer.url,
            PORT: '0',
          })

          expect(result.output).toContain('Starting Sovrium server')
          expect(result.output).toContain('remote-production-app')
        } finally {
          await mockServer.cleanup()
        }
      })
    }
  )
})
