/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Helpers for `social-components.tsx` (the SSR renderers for `comments` and
 * `comments` page component, both displays). Extracted to keep the main file under the
 * `max-lines: 300` cap imposed by `[internal ref]`.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Pick a string field from the component definition first, then from raw
 * props, falling back to a default when both are absent or wrong-typed.
 */
export function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: string
): string
export function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: undefined
): string | undefined
export function pickString(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: string | undefined
): string | undefined {
  if (typeof c[key] === 'string') return c[key] as string
  if (typeof props[key] === 'string') return props[key] as string
  return fallback
}

/** Pick a number field with the same component-then-props precedence. */
export function pickNumber(
  c: Record<string, unknown>,
  props: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  if (typeof c[key] === 'number') return c[key] as number
  if (typeof props[key] === 'number') return props[key] as number
  return fallback
}

export interface CommentsFields {
  readonly id: string | undefined
  readonly limit: number
  readonly sort: string
  readonly paginationStyle: string
  readonly emptyText: string
  readonly placeholder: string
  readonly table: string | undefined
  readonly recordId: string | undefined
}

export function resolveCommentsFields(
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
    placeholder: pickString(c, props, 'placeholder', 'Write a comment...'),
    table: pickString(c, props, 'table', undefined),
    recordId: pickString(c, props, 'recordId', undefined),
  }
}

/**
 * Resolve table-level comments config (PG-01/PG-02).
 */
export interface ResolvedCommentsConfig {
  readonly guestComments: boolean
  readonly guestEmailRequired: boolean
  readonly threading: boolean
  /** Whether the table's `comment` permission opens to unauthenticated visitors. */
  readonly commentPermissionAllowsAll: boolean
}

export function resolveTableCommentsConfig(
  tableName: string | undefined,
  tables: Tables | undefined
): ResolvedCommentsConfig {
  if (!tableName || !tables) {
    return {
      guestComments: false,
      guestEmailRequired: true,
      threading: false,
      commentPermissionAllowsAll: false,
    }
  }
  const table = tables.find((t) => t.name === tableName)
  if (!table) {
    return {
      guestComments: false,
      guestEmailRequired: true,
      threading: false,
      commentPermissionAllowsAll: false,
    }
  }
  const cfg = (table.comments ?? {}) as {
    guestComments?: boolean
    guestEmailRequired?: boolean
    threading?: boolean
  }
  const tablePerm = table.permissions as { comment?: string } | undefined
  return {
    guestComments: cfg.guestComments === true,
    guestEmailRequired: cfg.guestEmailRequired !== false,
    threading: cfg.threading === true,
    commentPermissionAllowsAll: isOpenToEveryone(toPermissionValue(tablePerm?.comment)),
  }
}

export interface CommentCountFields {
  readonly id: string | undefined
  readonly format: string
  readonly emptyText: string
  readonly emptyTextWasCustomized: boolean
  readonly table: string | undefined
  readonly recordId: string | undefined
}

export function resolveCommentCountFields(
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

/**
 * Resolve the user-facing label for the comment-count component.
 *
 * - When `count === 0`, prefer `emptyText`.
 * - Otherwise substitute `{count}` in `format` with the numeric value.
 */
export function resolveCountLabel(
  count: number,
  format: string,
  emptyText: string,
  emptyTextWasCustomized: boolean
): string {
  if (count === 0 && emptyTextWasCustomized) return emptyText
  if (count === 0 && format === '{count} comments') return emptyText
  return format.replace('{count}', String(count))
}

/**
 * Build the JSON-serialized props payload consumed by the comment-thread
 * hydration island (`src/presentation/islands/comment-thread-island.tsx`).
 *
 * `paginationStyle` is normalized: schema authors use `'numbered'`
 * interchangeably with the internal variant; `'loadMore'` is the documented
 * default.
 *
 * When a `session` is forwarded by the SSR pipeline, `currentUserId` and `currentUserIsAdmin` are
 * surfaced so the hydrated island can render the authenticated comment form,
 * per-comment edit/delete affordances for the author, and the admin
 * delete-any override. Anonymous requests omit both — the island then
 * renders the "Sign in to comment" prompt and read-only comment list.
 */
/**
 * Read a `data-testid` string from raw element props, or `undefined` when
 * it is absent / non-string. Shared by the thread + count island builders.
 */
function readTestId(elementProps: Record<string, unknown>): string | undefined {
  return typeof elementProps['data-testid'] === 'string' ? elementProps['data-testid'] : undefined
}

/**
 * `true` when the session carries the unrestricted flag — that grants the
 * delete-any override on the hydrated comment island.
 *
 * `isUnrestricted` is the canonical admin-equivalence flag, stamped at
 * session-establish time by `buildGetSession` via `isAdminEquivalent` (WI-5).
 * It already accounts for custom highest-`level` roles (cloud `operator`,
 * partner `engineer`) as well as built-in `admin`, so a literal `role ===
 * 'admin'` fallback here would be both redundant and a hardcode that misses
 * those custom superuser roles.
 */
function sessionIsAdmin(session: SessionInfo | undefined): boolean {
  return session?.isUnrestricted === true
}

export function buildCommentThreadIslandProps(input: {
  readonly fields: CommentsFields
  readonly elementProps: Record<string, unknown>
  readonly session?: SessionInfo
  readonly threading?: boolean
}): Record<string, unknown> {
  const { fields, elementProps, session, threading } = input
  const sort = fields.sort === 'oldest' ? 'oldest' : 'newest'
  const paginationStyle = fields.paginationStyle === 'numbered' ? 'numbered' : 'loadMore'
  return {
    tableName: fields.table,
    recordId: fields.recordId,
    limit: fields.limit,
    sort,
    paginationStyle,
    placeholder: fields.placeholder,
    emptyText: fields.emptyText,
    'data-testid': readTestId(elementProps),
    ...(session?.userId !== undefined ? { currentUserId: session.userId } : {}),
    ...(sessionIsAdmin(session) ? { currentUserIsAdmin: true } : {}),
    ...(threading === true ? { threading: true } : {}),
  }
}

/**
 * Build the JSON-serialized props payload consumed by the comment-count
 * hydration island. Returns `undefined` when `tableName` / `recordId` is
 * missing — the island can't fetch a count without both, so we keep the
 * SSR fallback label visible without mounting React.
 */
export function buildCommentCountIslandProps(input: {
  readonly fields: CommentCountFields
  readonly elementProps: Record<string, unknown>
}): string | undefined {
  const { fields, elementProps } = input
  if (!fields.table || !fields.recordId) return undefined
  return JSON.stringify({
    tableName: fields.table,
    recordId: fields.recordId,
    format: fields.format,
    emptyText: fields.emptyText,
    emptyTextWasCustomized: fields.emptyTextWasCustomized,
    'data-testid': readTestId(elementProps),
  })
}
