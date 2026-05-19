/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Page } from '@/domain/models/app/pages'

interface TaggedJsonLdEntry {
  readonly type: string
  readonly properties?: Readonly<Record<string, unknown>>
}

function isTaggedJsonLdEntry(value: unknown): value is TaggedJsonLdEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.type === 'string'
}

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
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(expandTaggedJsonLd(entry)),
          }}
        />
      ))}
    </>
  )
}

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
  const structuredData = page.meta?.schema ?? page.meta?.structuredData
  if (!structuredData) return undefined

  if (Array.isArray(structuredData)) return renderTaggedJsonLdArray(structuredData)

  if (typeof structuredData !== 'object' || structuredData === null) return undefined

  if ('@context' in structuredData && '@type' in structuredData) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    )
  }

  return renderOrchestratorJsonLd(structuredData)
}
