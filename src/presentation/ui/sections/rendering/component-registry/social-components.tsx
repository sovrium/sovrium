/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: string
): string
function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: undefined
): string | undefined
function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: string | undefined
): string | undefined {
  if (typeof c[key] === 'string') return c[key] as string
  if (typeof props[key] === 'string') return props[key] as string
  return fallback
}

function pickNumber(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  if (typeof c[key] === 'number') return c[key] as number
  if (typeof props[key] === 'number') return props[key] as number
  return fallback
}

interface CommentsFields {
  readonly id: string | undefined
  readonly limit: number
  readonly sort: string
  readonly paginationStyle: string
  readonly emptyText: string
  readonly table: string | undefined
  readonly recordId: string | undefined
}

function resolveCommentsFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>
): CommentsFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = (rawProps ?? {}) as Record<string, unknown>
  return {
    id: typeof elementProps.id === 'string' ? elementProps.id : undefined,
    limit: pickNumber(c, props, 'limit', 20),
    sort: pickString(c, props, 'sort', 'newest'),
    paginationStyle: pickString(c, props, 'paginationStyle', 'loadMore'),
    emptyText: pickString(c, props, 'emptyText', 'No comments yet'),
    table: pickString(c, props, 'table', undefined),
    recordId: pickString(c, props, 'recordId', undefined),
  }
}

export const commentsComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const f = resolveCommentsFields(component, rawProps, elementProps)
  const section: ReactElement = (
    <section
      id={f.id}
      data-component="comments"
      data-component-type="comments"
      data-comments-limit={String(f.limit)}
      data-comments-sort={f.sort}
      data-comments-pagination-style={f.paginationStyle}
      data-comments-table={f.table}
      data-comments-record-id={f.recordId}
      data-testid={
        typeof elementProps['data-testid'] === 'string' ? elementProps['data-testid'] : undefined
      }
      aria-label="Comments"
      className="comments my-6"
    >
      <p
        data-comments-empty-state=""
        className="text-muted-foreground text-sm"
      >
        {f.emptyText}
      </p>
    </section>
  )
  return section
}

interface CommentCountFields {
  readonly id: string | undefined
  readonly format: string
  readonly emptyText: string
  readonly emptyTextWasCustomized: boolean
  readonly table: string | undefined
  readonly recordId: string | undefined
}

function resolveCommentCountFields(
  component: Component | undefined,
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>
): CommentCountFields {
  const c = (component ?? {}) as Record<string, unknown>
  const props = (rawProps ?? {}) as Record<string, unknown>
  const customEmpty = pickString(c, props, 'emptyText', undefined)
  return {
    id: typeof elementProps.id === 'string' ? elementProps.id : undefined,
    format: pickString(c, props, 'format', '{count} comments'),
    emptyText: customEmpty ?? '0 comments',
    emptyTextWasCustomized: customEmpty !== undefined,
    table: pickString(c, props, 'table', undefined),
    recordId: pickString(c, props, 'recordId', undefined),
  }
}

function resolveCountLabel(
  count: number,
  format: string,
  emptyText: string,
  emptyTextWasCustomized: boolean
): string {
  if (count === 0 && emptyTextWasCustomized) {
    return emptyText
  }
  if (count === 0 && format === '{count} comments') {
    return emptyText
  }
  return format.replace('{count}', String(count))
}

export const commentCountComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const f = resolveCommentCountFields(component, rawProps, elementProps)
  const label = resolveCountLabel(0, f.format, f.emptyText, f.emptyTextWasCustomized)
  const span: ReactElement = (
    <span
      id={f.id}
      data-component="comment-count"
      data-component-type="comment-count"
      data-comment-count-format={f.format}
      data-comment-count-table={f.table}
      data-comment-count-record-id={f.recordId}
      data-testid={
        typeof elementProps['data-testid'] === 'string' ? elementProps['data-testid'] : undefined
      }
      aria-label="Comment count"
      className="comment-count text-muted-foreground text-sm"
    >
      {label}
    </span>
  )
  return span
}
