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
import { detectFormat } from '@/domain/utils'

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
 * Load and parse a referenced file.
 */
const loadReferencedFile = async (refPath: string): Promise<unknown> => {
  const file = Bun.file(refPath)
  const exists = await file.exists()

  if (!exists) {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Referenced file not found: ${refPath}`)
  }

  const content = await file.text()
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

export const resolveRefs = async (
  data: unknown,
  baseDir: string,
  visited: ReadonlySet<string> = new Set()
): Promise<unknown> => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data
  }

  // Top-level $ref object (e.g. an array element that is itself `{ $ref: "..." }`)
  // The referenced file's content replaces this node verbatim — no splicing.
  if (isRefObject(data)) {
    const refPath = resolve(baseDir, data.$ref)

    if (visited.has(refPath)) {
      // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
      throw new Error(`Circular $ref detected: ${refPath}`)
    }

    const newVisited = new Set([...visited, refPath])
    const loaded = await loadReferencedFile(refPath)
    const refDir = dirname(refPath)
    return resolveRefs(loaded, refDir, newVisited)
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => resolveRefs(item, baseDir, visited)))
  }

  const obj = data as Record<string, unknown>
  const entries = Object.entries(obj)

  const resolvedEntries = await Promise.all(
    entries.map(async ([key, value]): Promise<readonly [string, unknown]> => {
      if (isRefObject(value)) {
        const refPath = resolve(baseDir, value.$ref)

        if (visited.has(refPath)) {
          // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
          throw new Error(`Circular $ref detected: ${refPath}`)
        }

        const newVisited = new Set([...visited, refPath])
        const loaded = await loadReferencedFile(refPath)
        const refDir = dirname(refPath)
        const resolved = await resolveRefs(loaded, refDir, newVisited)
        return [key, resolved] as const
      }

      const resolved = await resolveRefs(value, baseDir, visited)
      return [key, resolved] as const
    })
  )

  return Object.fromEntries(resolvedEntries)
}
