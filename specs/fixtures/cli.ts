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
import { stopServer } from './server'
import type { CliServerResult } from './types'

/**
 * Helper to extract port from CLI server output
 */
function extractPortFromCliOutput(output: string): number | null {
  const match = output.match(/Homepage: http:\/\/localhost:(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : null
}

/**
 * Helper to create a temporary config file with specified extension
 * @param content - The file content (JSON string, YAML string, etc.)
 * @param extension - The file extension (json, yaml, yml, etc.)
 * @returns The path to the created config file
 */
export async function createTempConfigFile(content: string, extension: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-cli-test-'))
  const configPath = join(tempDir, `config.${extension}`)
  await writeFile(configPath, content, 'utf-8')
  return configPath
}

/**
 * Helper to clean up a temporary config file and its directory
 * @param configPath - The path to the config file
 */
export async function cleanupTempConfigFile(configPath: string): Promise<void> {
  await rm(join(configPath, '..'), { recursive: true, force: true })
}

/**
 * Helper to start CLI with a config file and wait for server to be ready
 * @param configPath - Path to the config file (.json, .yaml, .yml)
 * @param options - Optional port, hostname, and database URL
 * @returns Server details and cleanup function
 */
export async function startCliWithConfigFile(
  configPath: string,
  options?: {
    port?: number
    hostname?: string
    databaseUrl?: string
  }
): Promise<CliServerResult> {
  const args = ['run', 'src/cli.ts', 'start', configPath]

  const env = {
    ...process.env,
  } as Record<string, string>

  if (options?.port !== undefined) {
    env.PORT = options.port.toString()
  }

  if (options?.hostname) {
    env.HOSTNAME = options.hostname
  }

  if (options?.databaseUrl) {
    env.DATABASE_URL = options.databaseUrl
  }

  const serverProcess = spawn('bun', args, {
    env,
    stdio: 'pipe',
  })

  return new Promise((resolve, reject) => {
    const outputBuffer: string[] = []
    let resolved = false

    const handleOutput = (data: Buffer) => {
      const output = data.toString()
      outputBuffer.push(output)

      const port = extractPortFromCliOutput(output)
      if (port && !resolved) {
        resolved = true
        const url = `http://localhost:${port}`

        resolve({
          process: serverProcess,
          url,
          port,
          cleanup: async () => {
            await stopServer(serverProcess)
          },
        })
      }
    }

    serverProcess.stdout?.on('data', handleOutput)
    serverProcess.stderr?.on('data', handleOutput)

    serverProcess.on('error', (error) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Failed to start CLI server: ${error.message}`))
      }
    })

    serverProcess.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        reject(
          new Error(
            `CLI server exited with code ${code} before starting. Output: ${outputBuffer.join('\n')}`
          )
        )
      }
    })

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        serverProcess.kill()
        reject(new Error(`CLI server did not start within 10s. Output: ${outputBuffer.join('\n')}`))
      }
    }, 10_000)
  })
}

/**
 * Capture CLI command output (stdout + stderr) for error testing
 * @param configPath - Path to the config file to test
 * @param options - Optional settings for waitForServer, env, etc.
 * @returns Object with output, exitCode, and process
 */
export async function captureCliOutput(
  configPath: string,
  options?: {
    waitForServer?: boolean
    env?: Record<string, string>
    input?: string
  }
): Promise<{ output: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const args = ['run', 'src/cli.ts', 'start', configPath]

    const childProcess = spawn('bun', args, {
      env: {
        ...process.env,
        ...options?.env,
      },
      stdio: 'pipe',
    })

    const outputBuffer: string[] = []

    childProcess.stdout?.on('data', (data) => {
      outputBuffer.push(data.toString())
    })

    childProcess.stderr?.on('data', (data) => {
      outputBuffer.push(data.toString())
    })

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to execute CLI: ${error.message}`))
    })

    childProcess.on('exit', (code) => {
      const output = outputBuffer.join('')
      // Always resolve (don't reject on non-zero exit codes)
      // This allows tests to check error handling scenarios
      resolve({ output, exitCode: code })
    })

    // Send input if provided
    if (options?.input && childProcess.stdin) {
      childProcess.stdin.write(options.input)
      childProcess.stdin.end()
    }

    // Timeout after 10 seconds (CLI should fail fast for error cases)
    setTimeout(() => {
      childProcess.kill()
      resolve({ output: outputBuffer.join(''), exitCode: null })
    }, 10_000)
  })
}

// Re-export types from types.ts for convenience
export type { CliServerResult, CliOutputResult } from './types'
