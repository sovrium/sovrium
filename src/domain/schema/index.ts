/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Domain Module
 *
 * Pure functions for schema format detection and content parsing.
 */

export {
  type SchemaFormat,
  type FormatDetectionResult,
  detectFormat,
  getFileExtension,
  detectFormatFromContentType,
  detectFormatFromUrl,
  isInlineJson,
  isUrl,
} from './format-detection'

export { parseJsonContent, parseYamlContent, parseSchemaContent } from './content-parsing'
