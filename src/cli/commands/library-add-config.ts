/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add` — finding the config an install writes into: `--into`
 * kept inside the working directory (symbolic links included), else the
 * config discovered there, and the format it is written in; then judging it,
 * as it is and with an install's fragments in place.
 */

import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { isPathWithin } from '@/domain/models/process-env/desktop'
import { refuse } from './app-prelude'
import { loadConfigGraph } from './mcp-config-graph'
import { lazyImportSchema } from './utils'
import { validateParsedConfig } from './validate'
import type { LibraryTargetKey } from '@/library/manifest/define'

export type RootFormat = 'yaml' | 'json' | 'typescript'

/** `--into`, contained in the working directory — symlinks included. */
const resolveInto = async (cwd: string, into: string): Promise<string> => {
  const outside = (): never =>
    refuse(
      `Error: --into "${into}" resolves outside the working directory.\n\n` +
        `  library add only writes inside ${cwd}. Run it from the project directory instead.`
    )
  const candidate = resolve(cwd, into)
  if (!isPathWithin(cwd, candidate)) return outside()
  if (!(await Bun.file(candidate).exists())) return refuse(`Error: No config file at "${into}".`)
  return isPathWithin(await realpath(cwd), await realpath(candidate)) ? candidate : outside()
}

export const findConfig = async (cwd: string, into: string | undefined): Promise<string> => {
  if (into !== undefined) return resolveInto(cwd, into)
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(cwd)
  return discovered === undefined
    ? refuse(
        `Error: No app config found in ${cwd}.\n\n` +
          '  library add installs into an app config (app.yaml, app.yml or app.ts).\n' +
          '  Create one with `sovrium init`, or name one with --into <config>.'
      )
    : resolve(cwd, discovered)
}

export const rootFormatOf = (configPath: string): RootFormat => {
  const format = detectFormat(configPath)
  return format === 'unsupported'
    ? refuse('Error: Unsupported config format. Supported: .yaml, .yml, .json, .ts.')
    : format
}

/** The names the config already gives the items under `key`. */
export const definedNames = (parsed: unknown, key: LibraryTargetKey): ReadonlySet<string> => {
  const items = (parsed as Readonly<Record<string, unknown>> | undefined)?.[key]
  return new Set(
    Array.isArray(items)
      ? items.flatMap((item: unknown) => {
          const name = (item as { readonly name?: unknown } | null)?.name
          return typeof name === 'string' ? [name] : []
        })
      : []
  )
}

/** What the config says, judged. */
interface JudgedConfig {
  readonly parsed: unknown
  readonly errors: readonly string[]
}

/** Load the graph (optionally with stand-in bytes) and decode it, never throwing. */
export const judgeConfig = async (
  configPath: string,
  overlay?: ReadonlyMap<string, string>
): Promise<JudgedConfig> => {
  try {
    const graph = await loadConfigGraph(
      configPath,
      overlay === undefined ? undefined : (path) => overlay.get(path)
    )
    const outcome = await validateParsedConfig(graph.parsed, graph.refSources)
    return { parsed: graph.parsed, errors: outcome.errors }
  } catch (error) {
    return {
      parsed: undefined,
      errors: [`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`],
    }
  }
}

export const indented = (errors: readonly string[]): string =>
  errors.map((e) => `  ${e}`).join('\n')
