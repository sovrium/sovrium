/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'

/**
 * The files that make a project a STARTER, carried when they sit beside the
 * config: `CLAUDE.md`, the brief an AI reads first, and `PROMPT.md`, the first
 * prompt the person gives it. A project without them carries neither, and one
 * a page or an asset already carries is not carried twice.
 */
const STARTER_FILES = ['CLAUDE.md', 'PROMPT.md'] as const

export const collectStarterEntries = Effect.fn('server.collect-starter-entries')(function* (
  configPath: string,
  carried: readonly { readonly path: string }[]
) {
  const workspace = yield* BackupWorkspace
  const projectDir = dirname(configPath)
  const taken = new Set(carried.map((entry) => entry.path))
  const found = yield* Effect.forEach(
    STARTER_FILES.filter((file) => !taken.has(`project/${file}`)),
    (file) =>
      Effect.map(workspace.readFileIfExists(join(projectDir, file)), (bytes) =>
        bytes === undefined ? [] : [{ path: `project/${file}`, bytes }]
      )
  )
  return found.flat()
})
