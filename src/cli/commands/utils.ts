/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { StartOptions } from '@/application/use-cases/server/start-server'

/**
 * Lazy-import heavy modules to avoid loading native dependencies (lightningcss,
 * @tailwindcss/oxide) for commands that don't need them (--version, schema, init, agents).
 * This is critical for compiled binary mode where native .node modules cannot be
 * resolved from Bun's virtual filesystem.
 */
export const lazyImportIndex = () => import('@/index')
export const lazyImportLogger = () => import('@/infrastructure/logging/logger')
export const lazyImportSchema = () => import('@/infrastructure/schema')
export const lazyImportCli = () => import('@/presentation/cli')

/**
 * Reload server with new configuration from changed config file
 *
 * This function is called when the config file changes during --watch mode.
 * Uses dynamic imports to avoid loading native modules at startup.
 */
export const reloadServer = async (
  filePath: string,
  currentServer: { readonly stop: () => Promise<void> },
  options: StartOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import return type
): Promise<any> => {
  const { start } = await lazyImportIndex()
  const { loadSchemaFromFileForReload } = await lazyImportCli()

  // Parse the new config file (throws on invalid JSON/YAML, doesn't exit process)
  const newApp = await loadSchemaFromFileForReload(filePath)

  // Stop the current server before starting the new one
  // eslint-disable-next-line functional/no-expression-statements
  await currentServer.stop()

  // Start new server with the updated config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- StartOptions from dynamic import
  const newServer = await start(newApp, options as any)

  return newServer
}
