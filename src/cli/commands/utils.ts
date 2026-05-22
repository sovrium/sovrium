/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { StartOptions } from '@/application/use-cases/server/start-server'

export const lazyImportIndex = () => import('@/index')
export const lazyImportLogger = () => import('@/infrastructure/logging/logger')
export const lazyImportSchema = () => import('@/infrastructure/schema')
export const lazyImportCli = () => import('@/presentation/cli')

const waitForPortRelease = async (port: number, hostname: string, maxMs = 2000): Promise<void> => {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const probe = Bun.serve({ port, hostname, fetch: () => new Response() })
      probe.stop(true)
      return
    } catch (error) {
      const code = (error as { readonly code?: string } | null)?.code
      if (code !== 'EADDRINUSE') return
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}

export const reloadServer = async (
  filePath: string,
  currentServer: {
    readonly stop: () => Promise<void>
    readonly server?: { readonly port?: number }
  },
  options: StartOptions
): Promise<any> => {
  const { start } = await lazyImportIndex()
  const { loadSchemaFromFileForReload } = await lazyImportCli()

  const newApp = await loadSchemaFromFileForReload(filePath)

  const boundPort = currentServer.server?.port
  const hostname = options.hostname ?? Bun.env.HOSTNAME ?? 'localhost'

  await currentServer.stop()

  const { Effect } = await import('effect')
  const { clearCSSCache } = await import('@/infrastructure/css/cache/css-cache-service')
  const { clearPageCache } = await import('@/infrastructure/server/cache/page-cache-service')
  await Effect.runPromise(Effect.all([clearCSSCache(), clearPageCache()]))

  const reloadOptions: StartOptions =
    typeof boundPort === 'number' && boundPort > 0 ? { ...options, port: boundPort } : options
  if (typeof boundPort === 'number' && boundPort > 0) {
    await waitForPortRelease(boundPort, hostname)
  }

  const newServer = await start(newApp, reloadOptions as any)

  return newServer
}
