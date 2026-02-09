/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content Parsing - Pure Functions
 *
 * Domain layer utilities for parsing schema content.
 * These are pure functions with no side effects.
 */

import { load as parseYaml } from 'js-yaml'
import type { SchemaFormat } from './format-detection'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Parse JSON content to AppEncoded
 */
export const parseJsonContent = (content: string): AppEncoded => JSON.parse(content) as AppEncoded

/**
 * Parse YAML content to AppEncoded
 */
export const parseYamlContent = (content: string): AppEncoded => parseYaml(content) as AppEncoded

/**
 * Parse schema content based on detected format
 * Falls back to trying JSON first, then YAML if format is undefined
 */
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
  // Last fallback: try JSON first, then YAML
  try {
    return parseJsonContent(content)
  } catch {
    return parseYamlContent(content)
  }
}
