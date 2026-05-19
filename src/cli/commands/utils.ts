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

export const reloadServer = async (
  filePath: string,
  currentServer: { readonly stop: () => Promise<void> },
  options: StartOptions
): Promise<any> => {
  const { start } = await lazyImportIndex()
  const { loadSchemaFromFileForReload } = await lazyImportCli()

  const newApp = await loadSchemaFromFileForReload(filePath)

  await currentServer.stop()

  const newServer = await start(newApp, options as any)

  return newServer
}
