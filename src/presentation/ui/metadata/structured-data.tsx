/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Page } from '@/domain/models/app/pages'

/**
 * Tagged JSON-LD entry: `{ type: 'Article', properties: { headline, ... } }`.
 *
 * The collection-page metadata path (US-PAGES-COLLECTION-PAGES-003) accepts an
 * array of these entries so a schema author can declare a JSON-LD document
 * per record without authoring the verbose `@context`/`@type` keys manually —
 * the renderer expands `properties` into `@context: 'https://schema.org'`,
 * `@type: <type>`, and the rest of the keys.
 *
 * The `properties` object is `unknown`-typed because the schema is permissive
 * (`Schema.Unknown`) and the renderer only walks string values.
 */
interface TaggedJsonLdEntry {
  readonly type: string
  readonly properties?: Readonly<Record<string, unknown>>
}

/** Type guard for an entry shaped like `{ type, properties? }`. */
function isTaggedJsonLdEntry(value: unknown): value is TaggedJsonLdEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.type === 'string'
}

/**
 * Expands a tagged entry into a Schema.org-shaped JSON-LD document by
 * prepending `@context` and `@type` and copying `properties.*` into the
 * top-level. Any nested object that has its own `type` field but no
 * `@type` is recursively expanded so the configuration syntax (`{ type:
 * 'Person', name: '$record.author' }` inside `properties.author`) renders
 * as `{ '@type': 'Person', name: '...' }` in JSON-LD.
 */
function expandTaggedJsonLd(entry: TaggedJsonLdEntry): Record<string, unknown> {
  const propertyEntries = entry.properties
    ? Object.entries(entry.properties).map(
        ([key, value]) => [key, expandJsonLdValue(value)] as const
      )
    : []
  return {
    '@context': 'https://schema.org',
    '@type': entry.type,
    ...Object.fromEntries(propertyEntries),
  }
}

/** Recursive helper: expands nested `{ type, properties? }` into Schema.org shape. */
function expandJsonLdValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expandJsonLdValue)
  if (isTaggedJsonLdEntry(value)) {
    const propertyEntries = value.properties
      ? Object.entries(value.properties).map(([k, v]) => [k, expandJsonLdValue(v)] as const)
      : []
    return { '@type': value.type, ...Object.fromEntries(propertyEntries) }
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, expandJsonLdValue(v)])
    )
  }
  return value
}

/**
 * Render structured data as JSON-LD script tags
 * Generates Schema.org structured data for rich search results
 * Supports both 'schema' (canonical) and 'structuredData' (test alias)
 *
 * Handles three formats:
 * 1. Direct Schema.org object: { "@context": "...", "@type": "...", ... }
 * 2. Orchestrator schema: { organization: {...}, faqPage: {...}, ... }
 * 3. Tagged-entry array (B-4 collection pages):
 *    [{ type: 'Article', properties: { headline, ... } }, ...]
 *    — each entry expanded into a separate JSON-LD `<script>` tag with
 *      `@context: 'https://schema.org'` and `@type: <type>` prepended.
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
/** Renders an array of tagged JSON-LD entries as separate `<script>` tags. */
function renderTaggedJsonLdArray(
  structuredData: readonly unknown[]
): Readonly<ReactElement | undefined> {
  const entries = structuredData.filter(isTaggedJsonLdEntry)
  if (entries.length === 0) return undefined
  return (
    <>
      {entries.map((entry, index) => (
        <script
          key={`${entry.type}-${index}`}
          type="application/ld+json"
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script type=ld+json> rendered into <head>; never re-renders client-side
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(expandTaggedJsonLd(entry)),
          }}
        />
      ))}
    </>
  )
}

/** Renders an orchestrator-shaped object as one `<script>` per known type. */
function renderOrchestratorJsonLd(structuredData: object): Readonly<ReactElement | undefined> {
  const structuredDataTypes = Object.entries(structuredData).filter(
    ([, value]) => value !== undefined && value !== null
  )
  if (structuredDataTypes.length === 0) return undefined
  return (
    <>
      {structuredDataTypes.map(([key, value]) => (
        <script
          key={key}
          type="application/ld+json"
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script type=ld+json> rendered into <head>; never re-renders client-side
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(value),
          }}
        />
      ))}
    </>
  )
}

export function StructuredDataScript({
  page,
}: {
  readonly page: Page
}): Readonly<ReactElement | undefined> {
  // Support both 'schema' (canonical) and 'structuredData' (test alias)
  const structuredData = page.meta?.schema ?? page.meta?.structuredData
  if (!structuredData) return undefined

  // Tagged-entry array format (B-4 collection pages):
  //   [{ type: 'Article', properties: {...} }, { type: 'Person', properties: {...} }]
  if (Array.isArray(structuredData)) return renderTaggedJsonLdArray(structuredData)

  // Type guard: ensure structuredData is an object
  if (typeof structuredData !== 'object' || structuredData === null) return undefined

  // Direct Schema.org object format: { "@context": "...", "@type": "...", ... }
  if ('@context' in structuredData && '@type' in structuredData) {
    return (
      <script
        type="application/ld+json"
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script type=ld+json> rendered into <head>; never re-renders client-side
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    )
  }

  // Orchestrator schema format: { organization: {...}, faqPage: {...}, ... }
  return renderOrchestratorJsonLd(structuredData)
}
