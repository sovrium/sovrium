/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Remote Loader - Infrastructure Layer
 *
 * Network I/O operations for fetching schemas from remote URLs.
 */

import {
  detectFormatFromContentType,
  detectFormatFromUrl,
  parseSchemaContent,
} from '@/domain/schema'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Fetch and parse schema from a remote URL
 *
 * @throws Error if fetch fails or content cannot be parsed
 */
export const fetchRemoteSchema = async (url: string): Promise<AppEncoded> => {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(`Failed to fetch schema from ${url}: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()

    // Try to detect format from Content-Type header, then URL extension
    const format = detectFormatFromContentType(contentType) || detectFormatFromUrl(url)

    return parseSchemaContent(content, format)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Failed to fetch or parse schema from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
