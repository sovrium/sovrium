/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join, resolve } from 'node:path'


export const parseBooleanEnv = (value: string | undefined): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined

export const readPublicDirEnv = (): string | undefined => Bun.env.SOVRIUM_PUBLIC_DIR

const PUBLIC_DIR_OPTOUT_SENTINEL = 'none'

export const isPublicDirOptOut = (value: string | undefined): boolean =>
  value === PUBLIC_DIR_OPTOUT_SENTINEL

export const resolveDefaultPublicDir = (configFilePath: string | undefined): string | undefined => {
  if (!configFilePath) return undefined
  return join(dirname(resolve(configFilePath)), 'public')
}
