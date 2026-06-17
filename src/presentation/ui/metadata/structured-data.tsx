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

function isStructuredDataToggle(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return 'enabled' in (value as Record<string, unknown>)
}

function renderDirectJsonLdArray(
  documents: readonly Record<string, unknown>[]
): Readonly<ReactElement | undefined> {
  if (documents.length === 0) return undefined
  return (
    <>
      {documents.map((doc, index) => (
        <script
          key={`synth-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(doc),
          }}
        />
      ))}
    </>
  )
}

function resolveAuthoredStructuredData(page: Page): unknown {
  const aliasData = isStructuredDataToggle(page.meta?.structuredData)
    ? undefined
    : page.meta?.structuredData
  return page.meta?.schema ?? aliasData
}

function renderAuthoredStructuredData(structuredData: object): Readonly<ReactElement | undefined> {
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

export function StructuredDataScript({
  page,
  synthesized,
}: {
  readonly page: Page
  readonly synthesized?: readonly Record<string, unknown>[]
}): Readonly<ReactElement | undefined> {
  const structuredData = resolveAuthoredStructuredData(page)

  if (!structuredData) return renderDirectJsonLdArray(synthesized ?? [])

  if (Array.isArray(structuredData)) return renderTaggedJsonLdArray(structuredData)

  if (typeof structuredData !== 'object') return undefined

  return renderAuthoredStructuredData(structuredData)
}
