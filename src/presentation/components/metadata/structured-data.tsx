/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Page } from '@/domain/models/app/pages'

/**
 * Render structured data as JSON-LD script tags
 * Generates Schema.org structured data for rich search results
 * Supports both 'schema' (canonical) and 'structuredData' (test alias)
 *
 * Handles two formats:
 * 1. Direct Schema.org object: { "@context": "...", "@type": "...", ... }
 * 2. Orchestrator schema: { organization: {...}, faqPage: {...}, ... }
 *
 * Each structured data type is rendered as a separate <script type="application/ld+json">
 * tag for proper Schema.org validation
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Schema.org structured data (JSON.stringify)
 * - Source: Validated Page schema (page.meta.schema or page.meta.structuredData)
 * - Risk: None - JSON data cannot execute as code
 * - Validation: Schema validation ensures correct structure
 * - Purpose: Generate rich search results (SEO)
 * - XSS Protection: type="application/ld+json" prevents script execution
 * - Format: Safe serialization via JSON.stringify
 *
 * @param page - Page configuration
 * @returns React fragment with script tags or undefined
 */
export function StructuredDataScript({
  page,
}: {
  readonly page: Page
}): Readonly<ReactElement | undefined> {
  // Support both 'schema' (canonical) and 'structuredData' (test alias)
  const structuredData = page.meta?.schema ?? page.meta?.structuredData
  if (!structuredData) {
    return undefined
  }

  // Type guard: ensure structuredData is an object
  if (typeof structuredData !== 'object' || structuredData === null) {
    return undefined
  }

  // Check if this is a direct Schema.org object (has @context and @type)
  const isDirectSchemaObject = '@context' in structuredData && '@type' in structuredData

  // Handle direct Schema.org object format
  if (isDirectSchemaObject) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    )
  }

  // Handle orchestrator schema format (organization, faqPage, etc.)
  const structuredDataTypes = Object.entries(structuredData).filter(
    ([, value]) => value !== undefined && value !== null
  )

  if (structuredDataTypes.length === 0) {
    return undefined
  }

  return (
    <>
      {structuredDataTypes.map(([key, value]) => (
        <script
          key={key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(value),
          }}
        />
      ))}
    </>
  )
}
