/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { SchemaFormat } from './format-detection'
import type { AppEncoded } from '@/domain/models/app'

export const parseJsonContent = (content: string): AppEncoded => JSON.parse(content) as AppEncoded

export const parseYamlContent = (content: string): AppEncoded =>
  Bun.YAML.parse(content) as AppEncoded

export const parseSchemaContent = (
  content: string,
  format: SchemaFormat | undefined
): AppEncoded => {
  if (format === 'json') {
    return parseJsonContent(content)
  }
  if (format === 'yaml') {
    return parseYamlContent(content)
  }
  try {
    return parseJsonContent(content)
  } catch {
    return parseYamlContent(content)
  }
}
