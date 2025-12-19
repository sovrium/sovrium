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
  const args = ['run', 'src/cli.ts', '--config', configPath]

  if (options?.port) {
    args.push('--port', options.port.toString())
  }

  if (options?.hostname) {
    args.push('--hostname', options.hostname)
  }

  const env = {
    ...process.env,
  } as Record<string, string>

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
 * Capture CLI command output (stdout + stderr)
 * @param args - CLI command arguments (e.g., ['--version'])
 * @param options - Optional environment variables and input
 * @returns Combined stdout and stderr output
 */
export async function captureCliOutput(
  args: string[],
  options?: {
    env?: Record<string, string>
    input?: string
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('bun', ['run', 'src/cli.ts', ...args], {
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
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(`CLI exited with code ${code}. Output: ${output}`))
      }
    })

    // Send input if provided
    if (options?.input && childProcess.stdin) {
      childProcess.stdin.write(options.input)
      childProcess.stdin.end()
    }
  })
}
