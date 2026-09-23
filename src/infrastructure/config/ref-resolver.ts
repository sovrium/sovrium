/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * $ref Resolver - Infrastructure Layer
 *
 * Resolves $ref properties in parsed config objects by loading
 * referenced external YAML/JSON files and replacing the $ref
 * with the loaded content.
 */

import { dirname, resolve } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { findProjectJailEscape } from '@/domain/models/process-env/desktop'

/**
 * Check if a value is a $ref object: an object with exactly one key "$ref"
 * whose value is a string path.
 */
const isRefObject = (value: unknown): value is { readonly $ref: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  '$ref' in value &&
  typeof (value as Record<string, unknown>)['$ref'] === 'string'

/**
 * Stand-in bytes for one file of the graph, keyed by ABSOLUTE path.
 *
 * Returning `undefined` means "read this one from disk", so an overlay that
 * knows about one file leaves every other file of the graph untouched.
 *
 * It exists for one caller and one question: `_config_write_file` has to know
 * whether a candidate edit would still decode BEFORE the bytes reach the disk.
 * Resolving the graph with the candidate standing in for the file it replaces is
 * the only way to ask that of a `$ref` PARTIAL — judged on its own a partial is
 * just a document that happens to parse, and `tables[0].fields[2]` is not a
 * position it has.
 *
 * @public
 */
export type ConfigGraphOverlay = (absolutePath: string) => string | undefined

/**
 * Load and parse a referenced file, or the overlay's stand-in for it.
 */
const loadReferencedFile = async (
  refPath: string,
  overlay: ConfigGraphOverlay | undefined
): Promise<unknown> => {
  const standIn = overlay?.(refPath)
  const file = Bun.file(refPath)
  // An overlaid file need not exist yet: a candidate is judged on its bytes,
  // and a write that creates a partial has none on disk to check for.
  const exists = standIn !== undefined || (await file.exists())

  if (!exists) {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Referenced file not found: ${refPath}`)
  }

  const content = standIn ?? (await file.text())
  const format = detectFormat(refPath)

  try {
    if (format === 'json') {
      return JSON.parse(content) as unknown
    }
    if (format === 'yaml') {
      return Bun.YAML.parse(content) as unknown
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Failed to parse referenced file ${refPath}: ${message}`)
  }

  // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
  throw new Error(`Unsupported file format for $ref: ${refPath}`)
}

/**
 * Recursively resolve all $ref properties in a parsed config object.
 *
 * When a property value is `{ $ref: "./path.yaml" }`, the referenced file
 * is loaded, parsed, and its content replaces the $ref object. Resolution
 * is recursive — referenced files may themselves contain $ref properties.
 *
 * @param data - The parsed config object (or sub-object)
 * @param baseDir - The directory to resolve relative $ref paths against
 * @param visited - Set of resolved absolute paths to detect circular references
 */
/**
 * Collect $ref source mappings from a parsed config object (pre-resolution).
 *
 * Scans top-level properties for $ref objects and builds a map of
 * property names to their resolved absolute file paths. When a top-level
 * property is itself an array, each `{ $ref: "..." }` element is recorded
 * as `key[index]` (e.g. `tables[0]`, `tables[1]`) so that watch-mode can
 * track every referenced file, even when entities are split across one
 * file per item.
 *
 * @param data - The parsed config object (before ref resolution)
 * @param baseDir - The directory to resolve relative $ref paths against
 * @returns Map of property names (and indexed array elements) to absolute file paths
 */
export const collectRefSources = (data: unknown, baseDir: string): ReadonlyMap<string, string> => {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    return new Map()
  }

  const obj = data as Record<string, unknown>
  const entries: ReadonlyArray<readonly [string, string]> = Object.entries(obj).flatMap(
    ([key, value]) => {
      // Top-level property is itself a $ref — keep existing behavior
      if (isRefObject(value)) {
        return [[key, resolve(baseDir, value.$ref)] as const]
      }

      // Top-level property is an array — record each $ref element with an indexed key
      if (Array.isArray(value)) {
        return value.flatMap((item, index): ReadonlyArray<readonly [string, string]> => {
          if (isRefObject(item)) {
            return [[`${key}[${index}]`, resolve(baseDir, item.$ref)] as const]
          }
          return []
        })
      }

      return []
    }
  )

  return new Map(entries)
}

/**
 * A resolved node together with every file that was read to produce it.
 *
 * `files` holds ABSOLUTE paths in first-encounter order and may repeat a path
 * when two `$ref`s name the same file — `resolveRefsWithSources` deduplicates
 * once at the top.
 */
interface ResolvedNode {
  readonly value: unknown
  readonly files: ReadonlyArray<string>
}

/**
 * Follow one `$ref`: load the file it names, then resolve THAT document
 * against its own directory, recording the file on the way.
 */
const followRef = async (
  refPath: string,
  visited: ReadonlySet<string>,
  overlay: ConfigGraphOverlay | undefined
): Promise<ResolvedNode> => {
  if (visited.has(refPath)) {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Circular $ref detected: ${refPath}`)
  }

  // The project directory is a jail for the WHOLE config graph, not just its
  // root. That containment is what lets a supervising shell hand a folder to
  // the engine without also handing it the rest of the filesystem — a `$ref`
  // reaching out of the project would otherwise read any file the engine's own
  // user can read. Checked before the file is opened, so a refused reference
  // never discloses so much as its existence.
  //
  // Inert unless something declared a root: see `parseProjectDirJail`.
  const escape = findProjectJailEscape(refPath)
  if (escape) {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(
      `$ref resolves outside the project directory: ${escape.escaped}\n` +
        `The project directory is ${escape.root}, and the whole config graph must stay inside it.`
    )
  }

  const newVisited = new Set([...visited, refPath])
  const loaded = await loadReferencedFile(refPath, overlay)
  const nested = await resolveNode(loaded, dirname(refPath), newVisited, overlay)
  return { value: nested.value, files: [refPath, ...nested.files] }
}

const resolveNode = async (
  data: unknown,
  baseDir: string,
  visited: ReadonlySet<string>,
  overlay?: ConfigGraphOverlay | undefined
): Promise<ResolvedNode> => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return { value: data, files: [] }
  }

  // Top-level $ref object (e.g. an array element that is itself `{ $ref: "..." }`)
  // The referenced file's content replaces this node verbatim — no splicing.
  if (isRefObject(data)) {
    return followRef(resolve(baseDir, data.$ref), visited, overlay)
  }

  if (Array.isArray(data)) {
    const items = await Promise.all(
      data.map((item) => resolveNode(item, baseDir, visited, overlay))
    )
    return {
      value: items.map((item) => item.value),
      files: items.flatMap((item) => item.files),
    }
  }

  const obj = data as Record<string, unknown>
  const entries = Object.entries(obj)

  const resolvedEntries = await Promise.all(
    entries.map(async ([key, value]): Promise<readonly [string, ResolvedNode]> => {
      const resolved = isRefObject(value)
        ? await followRef(resolve(baseDir, value.$ref), visited, overlay)
        : await resolveNode(value, baseDir, visited, overlay)
      return [key, resolved] as const
    })
  )

  return {
    value: Object.fromEntries(resolvedEntries.map(([key, node]) => [key, node.value] as const)),
    files: resolvedEntries.flatMap(([, node]) => node.files),
  }
}

export const resolveRefs = async (
  data: unknown,
  baseDir: string,
  visited: ReadonlySet<string> = new Set()
): Promise<unknown> => (await resolveNode(data, baseDir, visited)).value

/**
 * The result of {@link resolveRefsWithSources}: the fully resolved document
 * and the deduplicated list of every file a `$ref` (at ANY depth) pulled in.
 */
export interface ResolvedRefs {
  readonly resolved: unknown
  readonly files: ReadonlyArray<string>
}

/**
 * Resolve every `$ref` exactly as {@link resolveRefs} does AND report the
 * absolute path of every file read along the way. The root document itself is
 * not listed — the caller already holds it.
 *
 * This is what a watcher needs: {@link collectRefSources} only sees the
 * top-level properties of the root, so a `$ref` inside a `$ref`-ed file (the
 * one-file-per-page split) is invisible to it. Callers recompute the set after
 * every reload, because a reload can add or drop a `$ref`.
 */
export const resolveRefsWithSources = async (
  data: unknown,
  baseDir: string,
  overlay?: ConfigGraphOverlay | undefined
): Promise<ResolvedRefs> => {
  const node = await resolveNode(data, baseDir, new Set(), overlay)
  return { resolved: node.value, files: [...new Set(node.files)] }
}
