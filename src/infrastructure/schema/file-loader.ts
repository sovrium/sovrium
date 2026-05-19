/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { dirname, resolve } from 'node:path'
import { detectFormat, getFileExtension, parseJsonContent, parseYamlContent } from '@/domain/utils'
import { resolveRefs } from './ref-resolver'
import type { AppEncoded } from '@/domain/models/app'

export const loadSchemaFromFile = async (filePath: string): Promise<AppEncoded> => {
  const file = Bun.file(filePath)
  const exists = await file.exists()

  if (!exists) {
    throw new Error(`File not found: ${filePath}`)
  }

  const format = detectFormat(filePath)

  if (format === 'typescript') {
    return loadSchemaFromTsFile(filePath)
  }

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    throw new Error(`Unsupported file format: .${extension}. Supported: .json, .yaml, .yml, .ts`)
  }

  const content = await file.text()
  const parsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  const absolutePath = resolve(filePath)
  const baseDir = dirname(absolutePath)

  return (await resolveRefs(parsed, baseDir)) as AppEncoded
}

export const loadSchemaFromTsFile = async (filePath: string): Promise<AppEncoded> => {
  const absolutePath = resolve(filePath)

  const module = await import(absolutePath)

  const config = module.default
  if (!config || typeof config !== 'object') {
    throw new Error(
      `TypeScript config file must have a default export.\n` +
        `Expected: export default { name: "my-app", ... }\n` +
        `Got: ${typeof config}`
    )
  }

  return config as AppEncoded
}

export const fileExists = async (filePath: string): Promise<boolean> => Bun.file(filePath).exists()

export const readFileContent = async (filePath: string): Promise<string> =>
  Bun.file(filePath).text()
