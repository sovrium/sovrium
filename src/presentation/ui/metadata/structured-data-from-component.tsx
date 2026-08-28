/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { serializeJsonForScript } from '@/domain/utils/json-script-serialization'

/**
 * Component meta property type for structured data
 */
export type ComponentMeta = {
  readonly title?: string
  readonly description?: string
  readonly image?: string
  readonly price?: string
  readonly currency?: string
  readonly structuredData?: {
    readonly type: string
    readonly fields: readonly string[]
  }
}

/**
 * Creates an offers object for Schema.org
 *
 * @param price - Product price
 * @param currency - Currency code
 * @returns Offers object or empty object
 */
function createOffer(price?: string, currency?: string): Record<string, unknown> {
  return price && currency
    ? {
        offers: {
          '@type': 'Offer',
          price,
          priceCurrency: currency,
        },
      }
    : {}
}

/**
 * Maps component meta field to Schema.org property
 *
 * @param fieldName - Schema.org field name
 * @param meta - Component meta configuration
 * @param fields - Enabled fields list
 * @returns Field object or empty object
 */
function mapMetaField(
  fieldName: string,
  meta: ComponentMeta,
  fields: readonly string[]
): Record<string, unknown> {
  if (!fields.includes(fieldName)) return {}

  const { title, description, image, price, currency } = meta

  if (fieldName === 'name' && title) return { name: title }
  if (fieldName === 'description' && description) return { description }
  if (fieldName === 'image' && image) return { image }
  if (fieldName === 'offers') return createOffer(price, currency)

  return {}
}

/**
 * Generates Schema.org structured data JSON-LD from component meta
 *
 * @param meta - Component meta configuration
 * @returns JSON-LD object following Schema.org format
 */
function generateStructuredData(meta: ComponentMeta): Record<string, unknown> {
  const { structuredData } = meta

  if (!structuredData) {
    return {}
  }

  // Build JSON-LD immutably using functional composition
  const baseJsonLd = {
    '@context': 'https://schema.org',
    '@type': structuredData.type,
  }

  const mappedFields = ['name', 'description', 'image', 'offers'].map((field) =>
    mapMetaField(field, meta, structuredData.fields)
  )

  return mappedFields.reduce((acc, field) => ({ ...acc, ...field }), baseJsonLd)
}

/**
 * Renders structured data script from component meta
 *
 * SECURITY: use of dangerouslySetInnerHTML
 * - Content: Schema.org JSON-LD from component metadata
 * - Source: Validated component meta configuration (component.meta.structuredData)
 * - Purpose: Generate rich search results from component content (SEO)
 * - Risk: a `</script>` sequence inside any string value closes the element
 *   early — `type="application/ld+json"` does not prevent that, the HTML
 *   tokenizer scans raw text for the literal delimiter and ignores `type`.
 * - Mitigation: `serializeJsonForScript` escapes `<` as `\u003c` (see its
 *   docstring). NEVER call `JSON.stringify` directly into a script body.
 *
 * @param props - Component props
 * @param props.meta - Component meta configuration
 * @returns Script element with JSON-LD structured data, or null if no structured data
 */
export function StructuredDataFromComponent({
  meta,
}: {
  readonly meta: ComponentMeta | undefined
}): ReactElement | undefined {
  if (!meta?.structuredData) {
    return undefined
  }

  const jsonLd = generateStructuredData(meta)

  if (Object.keys(jsonLd).length === 0) {
    return undefined
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element rendered into <head>; never re-renders client-side
      dangerouslySetInnerHTML={{
        __html: serializeJsonForScript(jsonLd, 2),
      }}
    />
  )
}
