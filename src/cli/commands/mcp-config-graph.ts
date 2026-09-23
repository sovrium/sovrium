/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One load of the config graph, for the two `sovrium mcp` surfaces that need
 * one.
 *
 * Shared rather than copied because the surfaces ask the SAME question of the
 * SAME files and must not be able to disagree about the answer: `_config_read`
 * reports the graph, `_config_write_file` judges a candidate against it, and a
 * second loader that attributed findings to a different partial — or followed a
 * `$ref` the first one did not — would make the two tools describe two apps.
 *
 * Re-read on EVERY call, deliberately. The caller is an AI that has just
 * rewritten a partial and is asking about what it wrote; a cached load would
 * answer about the file as it was when the process started, which is the one
 * answer that is never useful.
 */

import { resolve } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { computeConfigHash } from '@/infrastructure/server/lock-file'
import { lazyImportSchema } from './utils'
import type { ConfigGraphOverlay } from '@/infrastructure/config'

/** The bytes, the files, the `$ref` sources and the hash, in one read. */
export interface LoadedMcpGraph {
  /** The `$ref`-RESOLVED config, as parsed — never decoded. */
  readonly parsed: unknown
  /** Every file the graph was read from, absolute, root first. */
  readonly files: ReadonlyArray<string>
  /** Which partial each top-level entry came from, for finding attribution. */
  readonly refSources: ReadonlyMap<string, string>
  /** The root file's bytes — the overlay's, when one stood in for it. */
  readonly rootText: string
  /** The hash the lock file records and `X-Sovrium-Config` publishes. */
  readonly configHash: string
}

const dirOf = (filePath: string): string => resolve(filePath, '..')

/** The root document BEFORE `$ref` resolution — what the source map is built from. */
const parseRawRoot = async (content: string, format: 'json' | 'yaml'): Promise<unknown> => {
  const { parseJsonContent, parseYamlContent } =
    await import('@/domain/models/app/app-content-parsing')
  return format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
}

/**
 * Read the config graph, `$ref`s resolved, optionally with `overlay` bytes
 * standing in for one of its files.
 *
 * The overlay is bound 3 of [internal ref] A8 surface 10: a candidate edit is judged
 * as part of the app it belongs to rather than as a standalone document that
 * happens to parse, which is the only way `tables[0].fields[2]` is a position a
 * finding can name. It also arms bound 4 for free — the `$ref` jail lives in the
 * resolver, so a candidate that introduces a reference out of the project
 * directory THROWS here rather than being written and discovered at the next
 * boot.
 *
 * @throws Error when a file is missing, unparsable, or reaches out of the jail
 * @public
 */
export const loadConfigGraph = async (
  configPath: string,
  overlay?: ConfigGraphOverlay | undefined
): Promise<LoadedMcpGraph> => {
  const { loadSchemaGraphFromFile, collectRefSources } = await lazyImportSchema()
  const graph = await loadSchemaGraphFromFile(
    configPath,
    overlay === undefined ? {} : { readFile: overlay }
  )
  const rootText = overlay?.(resolve(configPath)) ?? (await Bun.file(configPath).text())
  const format = detectFormat(configPath)
  // A `.ts` config has no `$ref` graph to attribute against — its partials are
  // ordinary module imports, which carry their own filenames.
  const refSources =
    format === 'json' || format === 'yaml'
      ? collectRefSources(await parseRawRoot(rootText, format), dirOf(configPath))
      : new Map<string, string>()

  return {
    parsed: graph.config,
    files: graph.files,
    refSources,
    rootText,
    configHash: computeConfigHash(rootText),
  }
}
