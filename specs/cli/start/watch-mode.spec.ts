/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import {
  test,
  expect,
  createTempConfigFile,
  cleanupTempConfigFile,
  captureCliOutput,
} from '@/specs/fixtures'

/**
 * E2E Tests for CLI Start Command Watch Mode
 *
 * Source: src/cli.ts
 * Domain: cli
 * Spec Count: 7
 *
 * Watch Mode Behavior:
 * - Activates watch mode with --watch or -w flag
 * - Watches config file for changes and triggers hot reload
 * - Handles config changes for both JSON and YAML formats
 * - Keeps old server running if new config is invalid
 * - Displays watch status and reload feedback messages
 * - Gracefully handles rapid file changes
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('CLI Start Command - Watch Mode', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'CLI-START-WATCH-001: should activate watch mode with --watch flag',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid JSON config file
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'watch-mode-test',
          description: 'Testing --watch flag',
        }),
        'json'
      )

      try {
        // WHEN: Starting server with --watch flag
        const args = ['run', 'src/cli.ts', 'start', configPath, '--watch']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const output = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)
            // Wait for watch message
            if (text.includes('👀 Watching')) {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 5000)
        })

        // THEN: Watch mode is activated and displays watch message
        expect(output).toContain('Watch mode: enabled')
        expect(output).toContain('👀 Watching')
        expect(output).toContain(configPath)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-002: should activate watch mode with -w short flag',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid YAML config file
      const configPath = await createTempConfigFile(
        `
name: watch-short-flag-test
description: Testing -w flag
`,
        'yaml'
      )

      try {
        // WHEN: Starting server with -w flag
        const args = ['run', 'src/cli.ts', 'start', configPath, '-w']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const output = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)
            if (text.includes('👀 Watching')) {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 5000)
        })

        // THEN: Watch mode is activated with short flag
        expect(output).toContain('Watch mode: enabled')
        expect(output).toContain('👀 Watching')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-003: should reload server when JSON config file changes',
    { tag: '@spec' },
    async () => {
      // GIVEN: Running server in watch mode with JSON config
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'original-app-name',
          description: 'Original description',
        }),
        'json'
      )

      try {
        const args = ['run', 'src/cli.ts', 'start', configPath, '--watch']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const reloadOutput = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          let watchMessageSeen = false

          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)

            // Wait for watch mode to be ready
            if (!watchMessageSeen && text.includes('👀 Watching')) {
              watchMessageSeen = true
              // WHEN: Config file is modified with new content
              setTimeout(async () => {
                await writeFile(
                  configPath,
                  JSON.stringify({
                    name: 'updated-app-name',
                    description: 'Updated description',
                  }),
                  'utf-8'
                )
              }, 500)
            }

            // Wait for reload completion
            if (watchMessageSeen && text.includes('✅ Server reloaded')) {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 10_000)
        })

        // THEN: Server detects change and reloads successfully
        expect(reloadOutput).toContain('🔄 Config changed, reloading')
        expect(reloadOutput).toContain('✅ Server reloaded successfully')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-004: should reload server when YAML config file changes',
    { tag: '@spec' },
    async () => {
      // GIVEN: Running server in watch mode with YAML config
      const configPath = await createTempConfigFile(
        `
name: original-yaml-app
description: Original YAML description
`,
        'yaml'
      )

      try {
        const args = ['run', 'src/cli.ts', 'start', configPath, '--watch']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const reloadOutput = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          let watchMessageSeen = false

          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)

            if (!watchMessageSeen && text.includes('👀 Watching')) {
              watchMessageSeen = true
              // WHEN: YAML config file is modified
              setTimeout(async () => {
                await writeFile(
                  configPath,
                  `
name: updated-yaml-app
description: Updated YAML description
version: 2.0.0
`,
                  'utf-8'
                )
              }, 500)
            }

            if (watchMessageSeen && text.includes('✅ Server reloaded')) {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 10_000)
        })

        // THEN: Server detects YAML change and reloads
        expect(reloadOutput).toContain('🔄 Config changed, reloading')
        expect(reloadOutput).toContain('✅ Server reloaded successfully')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-005: should keep old server running when new config is invalid',
    { tag: '@spec' },
    async () => {
      // GIVEN: Running server in watch mode with valid config
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'stable-app',
          description: 'Stable configuration',
        }),
        'json'
      )

      try {
        const args = ['run', 'src/cli.ts', 'start', configPath, '--watch']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const errorOutput = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          let watchMessageSeen = false

          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)

            if (!watchMessageSeen && text.includes('👀 Watching')) {
              watchMessageSeen = true
              // WHEN: Config file is changed to invalid JSON (missing closing brace)
              setTimeout(async () => {
                await writeFile(
                  configPath,
                  `{
  "name": "broken-app",
  "description": "Missing closing brace"
`,
                  'utf-8'
                )
              }, 500)
            }

            // Wait for error message
            if (watchMessageSeen && text.includes('❌ Reload failed')) {
              setTimeout(() => {
                serverProcess.kill()
                resolve(outputBuffer.join(''))
              }, 500)
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 10_000)
        })

        // THEN: Server displays error but keeps running (doesn't crash)
        expect(errorOutput).toContain('🔄 Config changed, reloading')
        expect(errorOutput).toContain('❌ Reload failed')
        expect(errorOutput).not.toContain('✅ Server reloaded')
        // Server process should still be running (killed by timeout, not by crash)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-006: should display watch status messages in correct sequence',
    { tag: '@spec' },
    async () => {
      // GIVEN: Server starting in watch mode
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'message-test-app',
          description: 'Testing watch messages',
        }),
        'json'
      )

      try {
        const args = ['run', 'src/cli.ts', 'start', configPath, '--watch']
        const serverProcess = spawn('bun', args, { stdio: 'pipe' })

        const output = await new Promise<string>((resolve) => {
          const outputBuffer: string[] = []
          let watchMessageSeen = false

          const handleOutput = (data: Buffer) => {
            const text = data.toString()
            outputBuffer.push(text)

            if (!watchMessageSeen && text.includes('👀 Watching')) {
              watchMessageSeen = true
              // WHEN: Config file is modified with new content
              setTimeout(async () => {
                await writeFile(
                  configPath,
                  JSON.stringify({
                    name: 'updated-message-test',
                    description: 'Updated for message test',
                  }),
                  'utf-8'
                )
              }, 500)
            }

            if (watchMessageSeen && text.includes('✅ Server reloaded')) {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }
          }

          serverProcess.stdout?.on('data', handleOutput)
          serverProcess.stderr?.on('data', handleOutput)

          setTimeout(() => {
            serverProcess.kill()
            resolve(outputBuffer.join(''))
          }, 10_000)
        })

        // THEN: Messages appear in correct order with proper emoji indicators
        // Initial startup
        expect(output).toContain('Watch mode: enabled')

        // Watch mode activation
        expect(output).toContain('👀 Watching')
        expect(output).toContain('for changes')

        // Change detection
        expect(output).toContain('🔄 Config changed, reloading')

        // Success confirmation
        expect(output).toContain('✅ Server reloaded successfully')

        // Verify message order (watch → change → success)
        const watchIndex = output.indexOf('👀 Watching')
        const changeIndex = output.indexOf('🔄 Config changed')
        const successIndex = output.indexOf('✅ Server reloaded')

        expect(watchIndex).toBeLessThan(changeIndex)
        expect(changeIndex).toBeLessThan(successIndex)
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  test(
    'CLI-START-WATCH-007: should not activate watch mode without --watch or -w flag',
    { tag: '@spec' },
    async () => {
      // GIVEN: Valid JSON config file
      const configPath = await createTempConfigFile(
        JSON.stringify({
          name: 'no-watch-test',
          description: 'Testing without watch flag',
        }),
        'json'
      )

      try {
        // WHEN: Starting server WITHOUT watch flag
        const result = await captureCliOutput(configPath)

        // THEN: Server starts normally without watch mode messages
        expect(result.output).not.toContain('Watch mode: enabled')
        expect(result.output).not.toContain('👀 Watching')
        expect(result.output).toContain('Starting Sovrium server')
      } finally {
        await cleanupTempConfigFile(configPath)
      }
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'CLI-START-WATCH-008: user can develop with live config reloading across formats',
    { tag: '@regression' },
    async () => {
      await test.step('Start server in watch mode with JSON config', async () => {
        const configPath = await createTempConfigFile(
          JSON.stringify({
            name: 'dev-workflow-app',
            description: 'Development workflow test',
            version: '1.0.0',
          }),
          'json'
        )

        try {
          const args = ['run', 'src/cli.ts', 'start', configPath, '-w']
          const serverProcess = spawn('bun', args, { stdio: 'pipe' })

          const output = await new Promise<string>((resolve) => {
            const outputBuffer: string[] = []
            let stage = 0

            const handleOutput = (data: Buffer) => {
              const text = data.toString()
              outputBuffer.push(text)

              // Stage 0: Wait for watch mode
              if (stage === 0 && text.includes('👀 Watching')) {
                stage = 1
                // Stage 1: Make valid config change
                setTimeout(async () => {
                  await writeFile(
                    configPath,
                    JSON.stringify({
                      name: 'dev-workflow-app-v2',
                      description: 'Updated in dev',
                      version: '2.0.0',
                    }),
                    'utf-8'
                  )
                }, 500)
              }

              // Stage 1: Wait for successful reload
              if (stage === 1 && text.includes('✅ Server reloaded')) {
                stage = 2
                // Stage 2: Make invalid config change
                setTimeout(async () => {
                  await writeFile(configPath, '{ "name": "broken', 'utf-8')
                }, 500)
              }

              // Stage 2: Wait for error handling
              if (stage === 2 && text.includes('❌ Reload failed')) {
                stage = 3
                // Stage 3: Fix the config
                setTimeout(async () => {
                  await writeFile(
                    configPath,
                    JSON.stringify({
                      name: 'dev-workflow-app-fixed',
                      description: 'Fixed after error',
                      version: '2.1.0',
                    }),
                    'utf-8'
                  )
                }, 500)
              }

              // Stage 3: Wait for recovery
              if (stage === 3 && text.includes('✅ Server reloaded')) {
                serverProcess.kill()
                resolve(outputBuffer.join(''))
              }
            }

            serverProcess.stdout?.on('data', handleOutput)
            serverProcess.stderr?.on('data', handleOutput)

            setTimeout(() => {
              serverProcess.kill()
              resolve(outputBuffer.join(''))
            }, 15_000)
          })

          // Verify complete development workflow
          expect(output).toContain('Watch mode: enabled')
          expect(output).toContain('👀 Watching')

          // First successful reload
          expect(output).toMatch(/🔄 Config changed.*✅ Server reloaded/s)

          // Error handling (keeps server running)
          expect(output).toContain('❌ Reload failed')

          // Recovery after fix
          const reloadSuccesses = output.match(/✅ Server reloaded/g)
          expect(reloadSuccesses?.length).toBeGreaterThanOrEqual(2)
        } finally {
          await cleanupTempConfigFile(configPath)
        }
      })
    }
  )
})
