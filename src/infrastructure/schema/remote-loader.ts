/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  detectFormatFromContentType,
  detectFormatFromUrl,
  parseSchemaContent,
} from '@/domain/utils'
import type { AppEncoded } from '@/domain/models/app'

export const fetchRemoteSchema = async (url: string): Promise<AppEncoded> => {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch schema from ${url}: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()

    const format = detectFormatFromContentType(contentType) || detectFormatFromUrl(url)

    return parseSchemaContent(content, format)
  } catch (error) {
    throw new Error(
      `Failed to fetch or parse schema from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
