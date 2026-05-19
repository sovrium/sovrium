/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'

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

function generateStructuredData(meta: ComponentMeta): Record<string, unknown> {
  const { structuredData } = meta

  if (!structuredData) {
    return {}
  }

  const baseJsonLd = {
    '@context': 'https://schema.org',
    '@type': structuredData.type,
  }

  const mappedFields = ['name', 'description', 'image', 'offers'].map((field) =>
    mapMetaField(field, meta, structuredData.fields)
  )

  return mappedFields.reduce((acc, field) => ({ ...acc, ...field }), baseJsonLd)
}

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
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd, undefined, 2),
      }}
    />
  )
}
