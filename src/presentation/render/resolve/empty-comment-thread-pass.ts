/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `hideWhenEmpty` judgement of a `comments` thread, made on the server.
 *
 * A thread that sets `hideWhenEmpty` is drawn for nobody while it holds no
 * comment AND its reader cannot add one: the component is taken out of the
 * page before it is rendered, so the served HTML carries no section, no title
 * and no empty-state sentence that a script could later reveal. Anyone who may
 * comment still gets the thread (the renderer then leaves the empty-state
 * sentence out), and a thread with a comment is drawn as usual.
 *
 * The count is the APPROVED comments of the record — what every reader of the
 * record sees in its thread (`readCommentSummaries`), read for a record the
 * page's read gate already admitted — and nothing for a signed-out reader the
 * comments API serves no thread (an app with `auth`, a table without guest
 * comments). Whether the reader may comment is the
 * comments API's own create gate: the table's `comment` grant for a signed-in
 * reader, guest comments for a signed-out one.
 *
 * A thread whose record is not bound, or a render with no comment reader (a
 * static build), is left as written: without a count there is nothing to judge.
 * `display: count` never reads the key.
 */

import { servesNoAuthVisitor } from '@/domain/models/app/auth/anonymous-grant-service'
import { GUEST_USER_ID } from '@/domain/models/app/auth/guest-session'
import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import { hasCommentPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { writeGateRoles } from '@/presentation/render/resolve/write-permission-gates'
import {
  componentFields,
  entryAsComponent,
  rewriteComponent,
  type ComponentEntry,
} from './component-rewrite'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

type Table = NonNullable<App['tables']>[number]

interface EmptyThreadContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: Pick<DataSourceDb, 'readCommentSummaries'>
}

/** A thread asking to be hidden while empty, with the record it is bound to. */
interface HideableThread {
  readonly table: Table
  readonly recordId: string
}

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** The bound thread of a `comments` component that sets `hideWhenEmpty`, else `undefined`. */
function hideableThreadOf(component: Component, app: App): HideableThread | undefined {
  if (component.type !== 'comments') return undefined
  // The component's own key first, then its `props` — the renderer's precedence.
  const own = componentFields(component)
  const props = componentFields(component.props ?? {})
  const keyOf = (key: string): unknown => own[key] ?? props[key]
  if (keyOf('hideWhenEmpty') !== true || keyOf('display') === 'count') return undefined
  const recordId = stringOf(keyOf('recordId'))
  const table = app.tables?.find((t) => t.name === stringOf(keyOf('table')))
  return table === undefined || recordId === undefined ? undefined : { table, recordId }
}

const guestCommentsOn = (table: Table): boolean =>
  (table.comments as { readonly guestComments?: unknown } | undefined)?.guestComments === true

/**
 * Whether a signed-out reader is served the thread at all. In an app with
 * `auth`, the comments API answers her a thread only on a table with guest
 * comments; anywhere else her thread is empty whatever the record holds.
 */
const anonymousReadsThread = (table: Table, app: App): boolean =>
  servesNoAuthVisitor(app) || guestCommentsOn(table)

/**
 * Whether this reader may add a comment, as the comments API decides it: the
 * `comment` grant for a signed-in reader (the admin override included), and for
 * a signed-out one guest comments on a table whose `comment` grant is open to
 * everyone or not declared. An app with no `auth` serves every visitor by its
 * no-auth rule.
 */
function readerMayComment(table: Table, ctx: EmptyThreadContext): boolean {
  const { app, session } = ctx
  if (session === undefined) {
    if (servesNoAuthVisitor(app)) return hasCommentPermissionForRoles(table, [GUEST_USER_ID], app)
    const grant = (table.permissions as { readonly comment?: unknown } | undefined)?.comment
    return (
      guestCommentsOn(table) && (grant === undefined || isOpenToEveryone(toPermissionValue(grant)))
    )
  }
  if (session.isUnrestricted === true) return true
  return hasCommentPermissionForRoles(table, writeGateRoles(session), app)
}

/** `true` when the thread is empty for this reader and she cannot start it. */
async function drawsNothing(thread: HideableThread, ctx: EmptyThreadContext): Promise<boolean> {
  const read = ctx.db.readCommentSummaries
  if (read === undefined || readerMayComment(thread.table, ctx)) return false
  if (ctx.session === undefined && !anonymousReadsThread(thread.table, ctx.app)) return true
  const summaries = await read(thread.table, [thread.recordId])
  return (summaries.get(thread.recordId)?.count ?? 0) === 0
}

async function withoutEmptyThreads(
  components: readonly ComponentEntry[],
  ctx: EmptyThreadContext
): Promise<readonly ComponentEntry[]> {
  const kept = await Promise.all(
    components.map(async (item): Promise<ComponentEntry | undefined> => {
      if (typeof item === 'string' || 'component' in item || '$ref' in item) return item
      const node = entryAsComponent(item)
      const thread = hideableThreadOf(node, ctx.app)
      if (thread !== undefined && (await drawsNothing(thread, ctx))) return undefined
      if (!node.children || node.children.length === 0) return item
      return rewriteComponent(node, { children: await withoutEmptyThreads(node.children, ctx) })
    })
  )
  return kept.filter((item) => item !== undefined)
}

/** True when some `comments` component of the tree sets `hideWhenEmpty` — the pass's only trigger. */
const asksToHide = (components: readonly unknown[]): boolean =>
  JSON.stringify(components).includes('"hideWhenEmpty":true')

/**
 * The page less each `hideWhenEmpty` thread that is empty for a reader who
 * cannot comment. A page with no such thread — or no page (a 404, a refused
 * reader) — is returned as it came, unread.
 */
export async function withoutEmptyCommentThreads<T extends Page | object | undefined>(
  resolved: T,
  ctx: EmptyThreadContext
): Promise<T> {
  if (resolved === undefined || 'unauthorized' in resolved) return resolved
  const page = resolved as Page
  const { components } = page
  if (components === undefined || !asksToHide(components)) return resolved
  const shown = await withoutEmptyThreads(components, ctx)
  return { ...page, components: shown as Page['components'] } as T
}
