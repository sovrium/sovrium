/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Config Discovery - Infrastructure Layer
 *
 * Probes the working directory for a config file when the operator named none.
 *
 * Current directory ONLY, deliberately no parent walk: `start` anchors
 * `publicDir`, the config hash and `SOVRIUM_CONTENT_DIR` to `dirname(configPath)`,
 * and `seed` anchors its seed directory the same way. A parent-directory walk
 * would silently relocate both roots, so predictability wins over convenience.
 */

import { join } from 'node:path'
import { DEFAULT_CONFIG_FILENAMES } from '@/domain/utils'
import { fileExists } from './file-loader'

/**
 * First `DEFAULT_CONFIG_FILENAMES` entry that exists in `cwd`, or `undefined`.
 *
 * Returns the BARE relative filename (`app.yaml`, not an absolute path). That is
 * exactly the shape `sovrium start app.yaml` already passes, so a discovered
 * config travels the same code path as a named one and no new path semantics
 * enter the system.
 */
export const discoverDefaultConfigFile = async (cwd: string): Promise<string | undefined> => {
  const probes = await Promise.all(
    DEFAULT_CONFIG_FILENAMES.map((filename) => fileExists(join(cwd, filename)))
  )
  const index = probes.findIndex((exists) => exists)
  return index === -1 ? undefined : DEFAULT_CONFIG_FILENAMES[index]
}
