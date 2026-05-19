/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type { KanbanCardFooterItem } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactNode } from 'react'

export function formatRelativeDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 0) {
    const future = Math.abs(diffDays)
    if (future < 30) return `in ${future} days`
    if (future < 365) return `in ${Math.floor(future / 30)} months`
    return `in ${Math.floor(future / 365)} years`
  }
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function formatShortDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

export function renderFooterItem(item: KanbanCardFooterItem, record: TableRecord): ReactNode {
  const value = record[item.field]
  if (value === undefined || value === null || value === '') return undefined

  switch (item.format) {
    case 'relative-date':
      return (
        <span
          data-footer-format="relative-date"
          className="text-xs text-gray-500"
        >
          {formatRelativeDate(value)}
        </span>
      )
    case 'short-date':
      return (
        <span
          data-footer-format="short-date"
          className="text-xs text-gray-500"
        >
          {formatShortDate(value)}
        </span>
      )
    case 'avatar':
      return (
        <span
          data-footer-format="avatar"
          className="inline-flex items-center gap-1.5 text-xs text-gray-700"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700"
            aria-hidden="true"
          >
            {avatarInitials(String(value))}
          </span>
          <span>{String(value)}</span>
        </span>
      )
    case 'badge':
      return (
        <span
          data-footer-format="badge"
          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {String(value)}
        </span>
      )
    case 'text':
    default:
      return (
        <span
          data-footer-format="text"
          className="text-xs text-gray-700"
        >
          {String(value)}
        </span>
      )
  }
}
