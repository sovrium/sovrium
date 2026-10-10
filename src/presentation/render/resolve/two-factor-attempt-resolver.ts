/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A code page — a page holding a `verifyTwoFactor` form — reads the sign-in
 * waiting for its code once per render, from the request's signed cookie, and
 * tells each of its code forms two things:
 *
 * - **No sign-in is waiting** (none was started, or it lapsed) on a page that
 *   holds no sign-in form: the form shows that the sign-in has expired and a
 *   link back to `auth.loginPage`, instead of a field nothing could check. A
 *   page holding the password form too keeps its field — there the code is
 *   typed after the password, on the same page. The rest of what the page drew
 *   for a waiting sign-in is pruned (`two-factor-expired-page.ts`), so it says
 *   so once, with one way back.
 * - **A sign-in is waiting on a page of its own**: the code field takes focus
 *   as the page opens, the reader having just typed a password elsewhere.
 * - **Where that sign-in was headed**, kept on the server beside the attempt:
 *   a code form naming no `onSuccess.navigate` sends the reader there once the
 *   code is right. Never read from the page's own address.
 *
 * Runs on the tree with its references already inlined, so a code form placed
 * through a template or a library block is reached like any other.
 */

import { loginPageOf } from '@/domain/models/app/auth/login-page-service'
import { collapseExpiredCodePage } from './two-factor-expired-page'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** What a code form is told about the sign-in waiting for it (`action._twoFactor`). */
export interface TwoFactorAttemptStamp {
  /** No sign-in waits for this code: draw the expired notice instead of the field. */
  readonly expired: boolean
  /** A sign-in waits on a page of its own: the code field takes focus on load. */
  readonly focusCode: boolean
  /** The app's sign-in page, the notice's way back. */
  readonly loginPage: string
  /** Where the waiting sign-in was headed, kept on the server. */
  readonly destination?: string
}

type AuthAction = { readonly type?: unknown; readonly method?: unknown }

const actionOf = (node: unknown): AuthAction | undefined =>
  typeof node === 'object' && node !== null
    ? (node as { readonly action?: AuthAction }).action
    : undefined

/** Whether `node` is a form running auth method `method` (`login` when none is named). */
const runs = (node: unknown, method: string): boolean => {
  const action = actionOf(node)
  return action?.type === 'auth' && (action.method ?? 'login') === method
}

/** Whether any node of `tree`, at any depth, satisfies `test`. */
const someNode = (tree: unknown, test: (node: unknown) => boolean): boolean => {
  if (Array.isArray(tree)) return tree.some((child) => someNode(child, test))
  if (typeof tree !== 'object' || tree === null) return false
  return test(tree) || Object.values(tree).some((value) => someNode(value, test))
}

/** `tree` with `stamp` on the action of every code form, at any depth. */
const withStamp = (tree: unknown, stamp: TwoFactorAttemptStamp): unknown => {
  if (Array.isArray(tree)) return tree.map((child) => withStamp(child, stamp))
  if (typeof tree !== 'object' || tree === null) return tree
  const walked = Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      key === 'action' ? value : withStamp(value, stamp),
    ])
  )
  return runs(tree, 'verifyTwoFactor')
    ? { ...walked, action: { ...actionOf(tree), _twoFactor: stamp } }
    : walked
}

const isCodeForm = (node: unknown): boolean => runs(node, 'verifyTwoFactor')

/** Resolve one page's code forms; a page without one is returned as it was. */
export async function resolvePageTwoFactorAttempt(
  page: Page,
  input: {
    readonly app: App
    readonly db: DataSourceDb
    readonly cookies: Readonly<Record<string, string>> | undefined
  }
): Promise<Page> {
  const read = input.db.readTwoFactorAttempt
  if (read === undefined || !someNode(page.components, isCodeForm)) return page
  const attempt = await read(input.cookies).catch(() => ({ live: false }) as const)
  const holdsSignIn = someNode(page.components, (node) => runs(node, 'login'))
  const stamp: TwoFactorAttemptStamp = {
    expired: !attempt.live && !holdsSignIn,
    focusCode: attempt.live && !holdsSignIn,
    loginPage: loginPageOf(input.app.auth),
    ...('destination' in attempt && attempt.destination !== undefined
      ? { destination: attempt.destination }
      : {}),
  }
  const stamped = withStamp(page.components, stamp) as Page['components']
  const components = stamp.expired
    ? (collapseExpiredCodePage(stamped ?? [], stamp.loginPage) as Page['components'])
    : stamped
  return { ...page, components }
}
