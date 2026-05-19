/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createElement, type ReactNode } from 'react'
import type { TableRecord } from '../shared/types'

export const ALLOWED_CARD_ELEMENTS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'div',
  'small',
  'strong',
  'em',
])

export function safeChildProps(rawProps: unknown): { readonly className?: string } {
  if (!rawProps || typeof rawProps !== 'object') return {}
  const { className } = rawProps as { readonly className?: unknown }
  return typeof className === 'string' ? { className } : {}
}

export function substitute(text: string, record: TableRecord): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value === undefined || value === null ? '' : String(value)
  })
}

export function renderCardChild(
  child: Record<string, unknown>,
  record: TableRecord,
  index: number
): ReactNode {
  const elementName = typeof child['element'] === 'string' ? child['element'] : 'span'
  const tag = ALLOWED_CARD_ELEMENTS.has(elementName) ? elementName : 'span'
  const rawContent = typeof child['content'] === 'string' ? child['content'] : ''
  const text = substitute(rawContent, record)
  if (text === '') return undefined
  const props = safeChildProps(child['props'])
  return createElement(tag, { key: `child-${String(index)}`, ...props }, text)
}
