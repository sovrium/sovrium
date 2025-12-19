/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { execSync } from 'node:child_process'
import { platform } from 'node:os'

/**
 * Docker Service Management Utilities
 *
 * Provides cross-platform utilities to check Docker availability and automatically start
 * Docker daemon if it's not running. **Prioritizes open-source alternatives** to Docker Desktop:
 *
 * **Recommended (Open Source & Free):**
 * - Colima (macOS) - Lightweight, fast, MIT licensed - AUTO-INSTALLED if missing
 * - Docker Engine (Linux) - Official Docker daemon, Apache 2.0 licensed
 * - Podman (all platforms) - Daemonless alternative, Apache 2.0 licensed
 *
 * **Also Supported (Proprietary):**
 * - Docker Desktop (macOS/Windows/Linux) - Requires paid license for large companies
 *
 * This ensures E2E tests can run without Docker Desktop across all platforms.
 */

/**
 * Docker installation types we can detect and manage
 */
export type DockerInstallation =
  | 'docker-desktop' // Docker Desktop GUI app
  | 'docker-engine' // Standalone Docker Engine (Linux)
  | 'colima' // Colima (macOS Docker alternative)
  | 'podman' // Podman (Docker-compatible)
  | 'unknown' // Docker running but can't determine type

/**
 * Check if Docker daemon is running and accessible
 * Works with any Docker-compatible runtime (Docker, Colima, Podman, etc.)
 * Uses explicit paths to avoid PATH issues
 */
export function isDockerRunning(): boolean {
  // Find docker executable
  const dockerPath =
    ['/opt/homebrew/bin/docker', '/usr/local/bin/docker', '/usr/bin/docker'].find((path) => {
      try {
        execSync(`test -x ${path}`, { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }) || 'docker' // Fallback to PATH

  try {
    execSync(`${dockerPath} info`, { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if Homebrew is installed (macOS package manager)
 * Checks common installation paths for both Apple Silicon and Intel Macs
 */
function isHomebrewInstalled(): boolean {
  const brewPaths = [
    '/opt/homebrew/bin/brew', // Apple Silicon (M1/M2/M3)
    '/usr/local/bin/brew', // Intel Macs
  ]

  // Try common paths first
  for (const brewPath of brewPaths) {
    try {
      execSync(`test -x ${brewPath}`, { stdio: 'ignore' })
      return true
    } catch {
      // Continue checking other paths
    }
  }

  // Fallback to PATH-based detection
  try {
    execSync('which brew', { stdio: 'ignore', env: { ...process.env, PATH: process.env.PATH } })
    return true
  } catch {
    return false
  }
}

/**
 * Install Colima using Homebrew (macOS only)
 * Colima is an open-source Docker Desktop alternative
 */
async function installColima(): Promise<void> {
  if (!isHomebrewInstalled()) {
    throw new Error(
      'Homebrew is not installed. Please install Homebrew first:\n' +
        '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n' +
        'Or install Docker manually: https://docs.docker.com/engine/install/'
    )
  }

  console.log('📦 Installing Colima (open-source Docker alternative) via Homebrew...')
  console.log('   This may take a few minutes...')

  // Find brew executable
  const brewPath =
    ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'].find((path) => {
      try {
        execSync(`test -x ${path}`, { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }) || 'brew' // Fallback to PATH

  try {
    // Install both Colima and Docker CLI
    execSync(`${brewPath} install colima docker`, { stdio: 'inherit' })
    console.log('✅ Colima installed successfully')
  } catch (error) {
    throw new Error('Failed to install Colima. Please install Docker manually.', {
      cause: error,
    })
  }
}

/**
 * Detect which Docker installation is available on the system
 * Checks for common Docker runtimes in order of preference
 * Uses explicit paths to avoid PATH issues in subprocess environments
 */
export function detectDockerInstallation(): DockerInstallation | null {
  const os = platform()

  // Check for Colima (macOS alternative to Docker Desktop)
  if (os === 'darwin') {
    const colimaPaths = [
      '/opt/homebrew/bin/colima', // Apple Silicon
      '/usr/local/bin/colima', // Intel Mac
    ]

    for (const colimaPath of colimaPaths) {
      try {
        execSync(`test -x ${colimaPath}`, { stdio: 'ignore' })
        // Colima binary exists, check if it's running
        try {
          execSync(`${colimaPath} status`, { stdio: 'ignore' })
          return 'colima'
        } catch {
          // Colima installed but not running
          return 'colima'
        }
      } catch {
        // Try next path
      }
    }

    // Fallback to PATH-based detection
    try {
      execSync('which colima', { stdio: 'ignore' })
      return 'colima'
    } catch {
      // Colima not installed, continue checking
    }
  }

  // Check for Docker Desktop (all platforms)
  try {
    if (os === 'darwin') {
      execSync('test -d /Applications/Docker.app', { stdio: 'ignore' })
      return 'docker-desktop'
    } else if (os === 'win32') {
      execSync('where docker', { stdio: 'ignore' })
      return 'docker-desktop'
    }
  } catch {
    // Docker Desktop not found, continue checking
  }

  // Check for Docker Engine (primarily Linux)
  if (os === 'linux') {
    try {
      execSync('systemctl is-enabled docker', { stdio: 'ignore' })
      return 'docker-engine'
    } catch {
      // Check if docker command exists even without systemd
      try {
        execSync('which docker', { stdio: 'ignore' })
        return 'docker-engine'
      } catch {
        // Docker not installed
      }
    }
  }

  // Check for Podman (Docker-compatible alternative)
  try {
    execSync('which podman', { stdio: 'ignore' })
    return 'podman'
  } catch {
    // Podman not installed
  }

  return null
}

/**
 * Start Docker service based on detected installation
 * Supports multiple Docker runtimes across different platforms
 * Auto-installs Colima on macOS if no Docker installation found
 */
export async function startDockerService(): Promise<void> {
  let installation = detectDockerInstallation()

  // Auto-install Colima on macOS if no Docker found
  if (!installation && platform() === 'darwin') {
    console.log('🔍 No Docker installation found.')
    console.log('💡 Installing Colima (open-source, free alternative to Docker Desktop)...')
    await installColima()
    installation = 'colima'
  }

  if (!installation) {
    const os = platform()
    const suggestions: Record<string, string> = {
      linux:
        'Install Docker Engine:\n  curl -fsSL https://get.docker.com | sh\n  sudo systemctl enable --now docker',
      win32:
        'Install Docker Desktop or use WSL2 with Docker Engine:\n  https://docs.docker.com/desktop/install/windows-install/',
      darwin:
        'Install Colima (recommended):\n  brew install colima docker\nOr Docker Desktop:\n  https://docs.docker.com/desktop/install/mac-install/',
    }

    throw new Error(
      `No Docker installation detected.\n\n${suggestions[os] || 'Please install Docker and try again.'}`
    )
  }

  console.log(`🐳 Docker is not running. Starting ${installation}...`)

  const os = platform()

  try {
    switch (installation) {
      case 'colima': {
        // Find colima executable
        const colimaPath =
          ['/opt/homebrew/bin/colima', '/usr/local/bin/colima'].find((path) => {
            try {
              execSync(`test -x ${path}`, { stdio: 'ignore' })
              return true
            } catch {
              return false
            }
          }) || 'colima' // Fallback to PATH

        // Find docker executable
        const dockerPath =
          ['/opt/homebrew/bin/docker', '/usr/local/bin/docker'].find((path) => {
            try {
              execSync(`test -x ${path}`, { stdio: 'ignore' })
              return true
            } catch {
              return false
            }
          }) || 'docker' // Fallback to PATH

        // Start Colima on macOS
        execSync(`${colimaPath} start --runtime docker`, { stdio: 'inherit' })
        // Create/activate Colima Docker context
        try {
          execSync(`${dockerPath} context use colima`, { stdio: 'ignore' })
        } catch {
          // Context might not exist yet, create it
          execSync(
            `${dockerPath} context create colima --docker "host=unix://${process.env.HOME}/.colima/docker.sock"`,
            { stdio: 'ignore' }
          )
          execSync(`${dockerPath} context use colima`, { stdio: 'ignore' })
        }
        break
      }

      case 'docker-desktop':
        switch (os) {
          case 'darwin':
            // Start Docker Desktop on macOS
            execSync('open -a Docker', { stdio: 'ignore' })
            break
          case 'win32':
            // Start Docker Desktop on Windows
            // Use cmd.exe to run the start command
            execSync('cmd /c start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"', {
              stdio: 'ignore',
            })
            break
          case 'linux':
            // Start Docker Desktop on Linux (if using systemd)
            execSync('systemctl --user start docker-desktop', { stdio: 'ignore' })
            break
          default:
            throw new Error(`Unsupported platform for Docker Desktop: ${os}`)
        }
        break

      case 'docker-engine':
        // Start Docker Engine service (Linux)
        execSync('sudo systemctl start docker', { stdio: 'inherit' })
        break

      case 'podman':
        // Start Podman service
        execSync('systemctl --user start podman', { stdio: 'ignore' })
        break

      default:
        throw new Error(`Unsupported Docker installation type: ${installation}`)
    }
  } catch (error) {
    throw new Error(`Failed to start ${installation}. Please start it manually and try again.`, {
      cause: error,
    })
  }

  // Wait for Docker daemon to be ready
  await waitForDocker()

  console.log(`✅ ${installation} is now running`)
}

/**
 * Wait for Docker daemon to become available
 * Polls every 2 seconds with a 60 second timeout
 */
async function waitForDocker(timeoutMs: number = 60_000): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 2000 // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    if (isDockerRunning()) {
      return
    }

    console.log('⏳ Waiting for Docker to start...')
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(
    `Docker daemon failed to start within ${timeoutMs / 1000} seconds. ` +
      `Please check your Docker installation and try again.`
  )
}

/**
 * Ensure Docker is running, starting it automatically if needed
 * This is the main entry point for E2E test setup
 *
 * **Behavior:**
 * 1. Check if Docker daemon is already running → use it
 * 2. macOS: Auto-install Colima (open-source) if nothing found → start it
 * 3. Linux/Windows: Start existing Docker installation or show helpful error
 *
 * **Docker Desktop is NOT required** - this works with any Docker-compatible runtime
 */
export async function ensureDockerRunning(): Promise<void> {
  const installation = detectDockerInstallation()

  // Find docker executable for context commands
  const dockerPath =
    ['/opt/homebrew/bin/docker', '/usr/local/bin/docker', '/usr/bin/docker'].find((path) => {
      try {
        execSync(`test -x ${path}`, { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }) || 'docker'

  // Special handling for Colima: ensure Docker context is set correctly
  if (installation === 'colima') {
    try {
      execSync(`${dockerPath} context use colima`, { stdio: 'ignore' })
    } catch {
      // Context doesn't exist, will be created when we start Colima
    }
  }

  if (isDockerRunning()) {
    if (installation && installation !== 'unknown') {
      console.log(`✅ Docker daemon is already running (${installation})`)
    } else {
      console.log('✅ Docker daemon is already running')
    }
    return
  }

  await startDockerService()
}
