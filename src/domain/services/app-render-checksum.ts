/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHash } from 'node:crypto'
import type { App } from '@/domain/models/app'

const sortObjectKeys = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortObjectKeys)

  const record = value as Record<string, unknown>
  return Object.keys(record)
    .toSorted()
    .reduce<Record<string, unknown>>(
      (acc, key) => ({ ...acc, [key]: sortObjectKeys(record[key]) }),
      {}
    )
}

export const computeAppRenderChecksum = (app: App): string => {
  const renderSlice = {
    pages: app.pages,
    components: app.components,
    theme: app.theme,
    languages: app.languages,
    analytics: app.analytics,
  }
  const normalized = sortObjectKeys(renderSlice)
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
