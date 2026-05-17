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
import { detectFormat, getFileExtension, parseJsonContent, parseYamlContent } from '@/domain/utils'
import { resolveRefs } from './ref-resolver'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Load and parse schema from a file (throws on error, no process.exit)
 *
 * Automatically resolves $ref properties pointing to external files.
 *
 * @throws Error if file doesn't exist, format is unsupported, or parsing fails
 */
export const loadSchemaFromFile = async (filePath: string): Promise<AppEncoded> => {
  const file = Bun.file(filePath)
  const exists = await file.exists()

  if (!exists) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`File not found: ${filePath}`)
  }

  const format = detectFormat(filePath)

  if (format === 'typescript') {
    return loadSchemaFromTsFile(filePath)
  }

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`Unsupported file format: .${extension}. Supported: .json, .yaml, .yml, .ts`)
  }

  const content = await file.text()
  const parsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  const absolutePath = resolve(filePath)
  const baseDir = dirname(absolutePath)

  return (await resolveRefs(parsed, baseDir)) as AppEncoded
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

  // Dynamic import works with .ts files in both Bun runtime and compiled binaries
  const module = await import(absolutePath)

  const config = module.default
  if (!config || typeof config !== 'object') {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `TypeScript config file must have a default export.\n` +
        `Expected: export default { name: "my-app", ... }\n` +
        `Got: ${typeof config}`
    )
  }

  return config as AppEncoded
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
