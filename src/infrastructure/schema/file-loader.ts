/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * File Loader - Infrastructure Layer
 *
 * File system I/O operations for loading schema files.
 */

import {
  detectFormat,
  getFileExtension,
  parseJsonContent,
  parseYamlContent,
} from '@/domain/schema'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Load and parse schema from a file (throws on error, no process.exit)
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

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`Unsupported file format: .${extension}. Supported: .json, .yaml, .yml`)
  }

  const content = await file.text()

  return format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
}

/**
 * Check if a file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> =>
  Bun.file(filePath).exists()

/**
 * Read file content as text
 */
export const readFileContent = async (filePath: string): Promise<string> =>
  Bun.file(filePath).text()
