/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Format Detection - Pure Functions
 *
 * Domain layer utilities for detecting schema file formats.
 * These are pure functions with no side effects.
 */

/** Supported schema formats */
export type SchemaFormat = 'json' | 'yaml'

/** Format detection result */
export type FormatDetectionResult = SchemaFormat | 'unsupported'

/**
 * Detect file format from file extension
 */
export const detectFormat = (filePath: string): FormatDetectionResult => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'unsupported'
}

/**
 * Extract file extension from path
 */
export const getFileExtension = (filePath: string): string => {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

/**
 * Detect format from Content-Type header
 */
export const detectFormatFromContentType = (contentType: string): SchemaFormat | undefined => {
  if (contentType.includes('application/json')) return 'json'
  if (contentType.includes('application/x-yaml') || contentType.includes('text/yaml')) return 'yaml'
  return undefined
}

/**
 * Detect format from URL file extension
 */
export const detectFormatFromUrl = (url: string): SchemaFormat | undefined => {
  const urlLower = url.toLowerCase()
  if (urlLower.endsWith('.json')) return 'json'
  if (urlLower.endsWith('.yaml') || urlLower.endsWith('.yml')) return 'yaml'
  return undefined
}

/**
 * Check if a string value looks like inline JSON
 */
export const isInlineJson = (value: string): boolean => value.trim().startsWith('{')

/**
 * Check if a string value is a URL
 */
export const isUrl = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}
