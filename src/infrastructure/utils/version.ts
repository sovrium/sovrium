/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePackagePath } from './package-paths'

declare const __SOVRIUM_VERSION__: string | undefined

export const getSovriumVersion = async (): Promise<string> => {
  if (typeof __SOVRIUM_VERSION__ !== 'undefined') {
    return __SOVRIUM_VERSION__
  }
  try {
    const { version } = (await Bun.file(resolvePackagePath('package.json')).json()) as {
      version?: string
    }
    return typeof version === 'string' && version.length > 0 ? version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}
