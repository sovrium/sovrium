/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, resolve } from 'node:path'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The three steps `loadConfigForValidationWithSources` (in `validate.ts`) runs
 * to read a config file for validation: it exists, its extension is supported,
 * and it parses — returning both the resolved data and its `$ref` source map.
 */

/** Exit with an error when the config file does not exist. */
export const validateFileExists = async (filePath: string): Promise<void> => {
  const exists = await Bun.file(filePath).exists()
  if (!exists) {
    printStderr(`Error: File not found: ${filePath}`)
    process.exit(1)
  }
}

export const validateFileFormat = (filePath: string): ReturnType<typeof detectFormat> => {
  const format = detectFormat(filePath)
  if (format === 'unsupported') {
    printStderr(`Error: Unsupported file format. Supported: .json, .yaml, .yml, .ts`)
    process.exit(1)
  }
  return format
}

export const parseConfigWithRefSources = async (
  filePath: string,
  format: ReturnType<typeof detectFormat>,
  loadFromFile: (path: string) => Promise<unknown>,
  collectRefSources: (data: unknown, baseDir: string) => ReadonlyMap<string, string>
): Promise<{ readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> }> => {
  // TypeScript configs use native imports, no $ref resolution needed
  if (format === 'typescript') {
    const parsed = await loadFromFile(filePath)
    return { parsed, refSources: new Map<string, string>() }
  }

  const { parseYamlContent, parseJsonContent } =
    await import('@/domain/models/app/app-content-parsing')

  // Read and parse raw content to collect $ref sources before resolution
  const content = await Bun.file(filePath).text()
  const rawParsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  const absolutePath = resolve(filePath)
  const baseDir = dirname(absolutePath)
  const refSources = collectRefSources(rawParsed, baseDir)

  // Load with full $ref resolution
  const parsed = await loadFromFile(filePath)
  return { parsed, refSources }
}
