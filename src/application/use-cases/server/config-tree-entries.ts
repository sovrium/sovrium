/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, isAbsolute, relative, sep } from 'node:path'
import { Effect } from 'effect'
import { BackupWorkspace } from '@/application/ports/services/backup-workspace'

/** `a/b/c` regardless of the platform separator. */
export const toEntryPath = (path: string): string => path.split(sep).join('/')

/** The first file of a config graph that sits outside the config's own directory. */
export const findFileOutsideDirectory = (
  directory: string,
  files: readonly string[]
): string | undefined =>
  files.find((file) => {
    const rel = relative(directory, file)
    return rel.startsWith('..') || isAbsolute(rel)
  })

/**
 * The config file and every `$ref` target it reads, as `<prefix><relative>`
 * archive entries — the tree `sovrium backup` carries and `sovrium bundle`
 * checks — or the caller's refusal when one target lies outside the config
 * directory, since an archive could not put it back in the same place.
 *
 * The refusal is the caller's because its wording is: each archive names its
 * own verb in the guidance.
 */
export const collectConfigEntries = Effect.fn('server.collect-config-entries')(function* <E>(
  configPath: string,
  prefix: string,
  refuseOutside: (outside: string, configDir: string) => E
) {
  const workspace = yield* BackupWorkspace
  const graph = yield* workspace.loadConfigGraph(configPath)
  // Measured from the root AS THE LOADER RESOLVED IT, not from `configPath`:
  // a TypeScript root comes back through its real path (`/tmp` is
  // `/private/tmp` on macOS), and comparing the two spellings would call the
  // config file itself "outside" its own directory.
  const configDir = dirname(graph.files[0] ?? configPath)
  const outside = findFileOutsideDirectory(configDir, graph.files)
  if (outside !== undefined) return yield* Effect.fail(refuseOutside(outside, configDir))
  const entries = yield* Effect.forEach(graph.files, (file) =>
    Effect.map(workspace.readFileIfExists(file), (bytes) => ({
      path: `${prefix}${toEntryPath(relative(configDir, file))}`,
      bytes: bytes ?? new Uint8Array(),
    }))
  )
  return { name: graph.name, entries }
})
