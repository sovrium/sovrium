/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * File Loader - Infrastructure Layer
 *
 * File system I/O operations for loading schema files.
 */

import { dirname, resolve } from 'node:path'
import { detectFormat, getFileExtension } from '@/domain/kernel/config-parsing/format-detection'
import { parseJsonContent, parseYamlContent } from '@/domain/models/app/app-content-parsing'
import { resolveRefs, resolveRefsWithSources } from './ref-resolver'
import { loadTsConfigGraph, requireDefaultExportObject, scanTsConfigGraph } from './ts-config-graph'
import type { ConfigGraphOverlay } from './ref-resolver'
import type { AppEncoded } from '@/domain/models/app'

/**
 * What a caller may hand {@link loadSchemaGraphFromFile} beyond the path.
 *
 * One option, and it exists for one caller — see {@link ConfigGraphOverlay}.
 * Every other load leaves it unset and reads the graph entirely from disk,
 * which is what makes this additive rather than a new code path to keep in step.
 */
export interface ConfigGraphLoadOptions {
  /** Stand-in bytes for one or more files of the graph, by ABSOLUTE path. */
  readonly readFile?: ConfigGraphOverlay | undefined
}

/**
 * A config together with the absolute path of every file it was read from:
 * the root, plus every TypeScript module it imports or every YAML/JSON file
 * it reaches through `$ref`, at any depth. `--watch` watches exactly this set.
 */
export interface LoadedConfigGraph {
  readonly config: AppEncoded
  readonly files: ReadonlyArray<string>
}

/**
 * A root document parsed but not yet `$ref`-resolved — the shared first step
 * of every YAML/JSON load, with the existence and format checks applied.
 */
interface ParsedRoot {
  readonly format: 'json' | 'yaml' | 'typescript'
  readonly absolutePath: string
  readonly parsed: unknown
}

const readRoot = async (
  filePath: string,
  overlay: ConfigGraphOverlay | undefined
): Promise<ParsedRoot> => {
  const absolutePath = resolve(filePath)
  const standIn = overlay?.(absolutePath)
  const file = Bun.file(filePath)
  const exists = standIn !== undefined || (await file.exists())

  if (!exists) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`File not found: ${filePath}`)
  }

  const format = detectFormat(filePath)

  if (format === 'typescript') {
    return { format, absolutePath, parsed: undefined }
  }

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`Unsupported file format: .${extension}. Supported: .json, .yaml, .yml, .ts`)
  }

  const content = standIn ?? (await file.text())
  const parsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  return { format, absolutePath, parsed }
}

/**
 * Load and parse schema from a file (throws on error, no process.exit)
 *
 * Automatically resolves $ref properties pointing to external files.
 *
 * @throws Error if file doesn't exist, format is unsupported, or parsing fails
 */
export const loadSchemaFromFile = async (filePath: string): Promise<AppEncoded> => {
  const root = await readRoot(filePath, undefined)

  if (root.format === 'typescript') {
    return loadSchemaFromTsFile(filePath)
  }

  return (await resolveRefs(root.parsed, dirname(root.absolutePath))) as AppEncoded
}

/**
 * Load a config AND the set of files it is made of, evaluating a `.ts` root
 * FRESH rather than through Bun's ESM registry.
 *
 * This is the loader `--watch` reloads through. {@link loadSchemaFromFile}
 * keeps the plain `import()` for every other command: it is the cheapest path
 * and none of them ever loads the same file twice in one process. A reload
 * does — and a plain `import()` of a `.ts` root then returns the module
 * evaluated at boot, so the served HTML never changes.
 *
 * @throws Error on the same conditions as {@link loadSchemaFromFile}
 */
export const loadSchemaGraphFromFile = async (
  filePath: string,
  options: ConfigGraphLoadOptions = {}
): Promise<LoadedConfigGraph> => {
  const root = await readRoot(filePath, options.readFile)

  if (root.format === 'typescript') {
    // A `.ts` root is BUNDLED rather than read, so an overlay cannot stand in
    // for one of its modules. Refused rather than silently ignored: a caller
    // that believed it was judging a candidate would otherwise be handed the
    // config already on disk and told it decodes.
    if (options.readFile !== undefined) {
      // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
      throw new Error(
        'A TypeScript config cannot be overlaid: its partials are module imports, not `$ref` ' +
          'files. Edit the `.ts` config directly.'
      )
    }
    return loadTsConfigGraph(root.absolutePath)
  }

  const { resolved, files } = await resolveRefsWithSources(
    root.parsed,
    dirname(root.absolutePath),
    options.readFile
  )
  return { config: resolved as AppEncoded, files: [root.absolutePath, ...files] }
}

/**
 * The files a config is made of, without evaluating a `.ts` root — for the
 * initial watched set, once the boot path has already loaded the config.
 *
 * A YAML/JSON root is re-read and its `$ref`s followed (cheap, side-effect
 * free); a `.ts` root is bundled without being imported.
 */
export const collectConfigGraphFiles = async (filePath: string): Promise<ReadonlyArray<string>> => {
  const root = await readRoot(filePath, undefined)

  if (root.format === 'typescript') {
    return scanTsConfigGraph(root.absolutePath)
  }

  const { files } = await resolveRefsWithSources(root.parsed, dirname(root.absolutePath))
  return [root.absolutePath, ...files]
}

/**
 * Load schema from a TypeScript config file.
 *
 * Uses dynamic import() to load the file — Bun natively executes .ts files,
 * including inside compiled binaries (which embed the Bun runtime).
 *
 * The file must have a default export containing the app configuration object.
 *
 * @throws Error if the file has no default export or the export is not an object
 */
export const loadSchemaFromTsFile = async (filePath: string): Promise<AppEncoded> => {
  const absolutePath = resolve(filePath)

  // Dynamic import works with .ts files in both Bun runtime and compiled binaries.
  // It is also CACHED for the life of the process — see `loadSchemaGraphFromFile`
  // for the path a reload must take instead.
  const module = (await import(absolutePath)) as { readonly default?: unknown }

  return requireDefaultExportObject(module)
}

/**
 * Check if a file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => Bun.file(filePath).exists()

/**
 * Read file content as text
 */
export const readFileContent = async (filePath: string): Promise<string> =>
  Bun.file(filePath).text()
