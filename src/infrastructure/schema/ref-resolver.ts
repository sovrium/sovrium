/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { dirname, resolve } from 'node:path'
import { detectFormat } from '@/domain/utils'

const isRefObject = (value: unknown): value is { readonly $ref: string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  '$ref' in value &&
  typeof (value as Record<string, unknown>)['$ref'] === 'string'

const loadReferencedFile = async (refPath: string): Promise<unknown> => {
  const file = Bun.file(refPath)
  const exists = await file.exists()

  if (!exists) {
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
    throw new Error(`Failed to parse referenced file ${refPath}: ${message}`)
  }

  throw new Error(`Unsupported file format for $ref: ${refPath}`)
}

export const collectRefSources = (data: unknown, baseDir: string): ReadonlyMap<string, string> => {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    return new Map()
  }

  const obj = data as Record<string, unknown>
  const entries = Object.entries(obj)
    .filter(([, value]) => isRefObject(value))
    .map(
      ([key, value]) => [key, resolve(baseDir, (value as { readonly $ref: string }).$ref)] as const
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
