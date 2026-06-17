/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type SchemaFormat = 'json' | 'yaml' | 'typescript'

export type FormatDetectionResult = SchemaFormat | 'unsupported'

export const detectFormat = (filePath: string): FormatDetectionResult => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.mts')) return 'typescript'
  return 'unsupported'
}

export const getFileExtension = (filePath: string): string => {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

export const detectFormatFromContentType = (contentType: string): SchemaFormat | undefined => {
  if (contentType.includes('application/json')) return 'json'
  if (contentType.includes('application/x-yaml') || contentType.includes('text/yaml')) return 'yaml'
  return undefined
}

export const detectFormatFromUrl = (url: string): SchemaFormat | undefined => {
  const urlLower = url.toLowerCase()
  if (urlLower.endsWith('.json')) return 'json'
  if (urlLower.endsWith('.yaml') || urlLower.endsWith('.yml')) return 'yaml'
  return undefined
}

export const isInlineJson = (value: string): boolean => value.trim().startsWith('{')

export const isUrl = (value: string): boolean => {
  const trimmed = value.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}
