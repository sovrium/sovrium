/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
export type SchemaFormat = 'json' | 'yaml' | 'typescript'

/** Format detection result */
export type FormatDetectionResult = SchemaFormat | 'unsupported'

/**
 * Detect file format from file extension
 */
export const detectFormat = (filePath: string): FormatDetectionResult => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.mts')) return 'typescript'
  return 'unsupported'
}

/**
 * Extract file extension from path
 */
export const getFileExtension = (filePath: string): string => {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

/** The media types that name a config format. Anything else names none. */
const MEDIA_TYPE_FORMATS: Readonly<Record<string, SchemaFormat>> = {
  'application/json': 'json',
  'application/yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
}

/**
 * Detect format from a Content-Type header.
 *
 * Reads the media type only (parameters such as `charset` are dropped) and
 * compares it case-insensitively. A generic type (`text/plain`,
 * `binary/octet-stream`) names no format and returns `undefined`.
 */
export const detectFormatFromContentType = (contentType: string): SchemaFormat | undefined => {
  const mediaType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  return Object.hasOwn(MEDIA_TYPE_FORMATS, mediaType) ? MEDIA_TYPE_FORMATS[mediaType] : undefined
}

/**
 * Detect format from the extension of a URL's PATH.
 *
 * The query string and the fragment never decide: a signature, a download name
 * or a cache buster says nothing about the bytes. A string that does not parse
 * as a URL returns `undefined`.
 */
export const detectFormatFromUrl = (url: string): SchemaFormat | undefined => {
  const pathname = URL.parse(url)?.pathname.toLowerCase()
  if (pathname === undefined) return undefined
  if (pathname.endsWith('.json')) return 'json'
  if (pathname.endsWith('.yaml') || pathname.endsWith('.yml')) return 'yaml'
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
