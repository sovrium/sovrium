/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `dataSource: { auth: <list> }` as the rest of resolution reads it.
 *
 * An account list is read by the engine's own scoped endpoint
 * (`GET /api/account/lists/<list>`), so the binding becomes the system read of
 * that endpoint — and every downstream island (a `table`, a `list`) draws it
 * exactly as it draws any system source, with the reader's own credentials.
 * The binding names no path: the engine owns it, so no config can widen it.
 *
 * A list the reader may not read is WITHHELD rather than bound: `members` and
 * `invitations` for anyone who may not administer accounts, and every list for
 * a signed-out visitor. The component leaves the page — the same answer the
 * endpoint gives (404), and no island configuration naming the list is shipped.
 *
 * A FORM running an account method is held to the same rule: the methods that
 * act on the reader's own keys, passkeys, sessions and second factor leave the
 * page of a signed-out visitor, and the ones that act on another member
 * (`setRole`, `resendInvitation`, `revokeInvitation`) the page of anyone who
 * may not administer accounts. A form that could only fail would advertise a
 * capability the reader does not have.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isComponentReferenceNode } from './component-reference'
import { isDroppedWithheld, withheldComponent } from './withheld-component'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/** The lists that range over the whole app, read only by an administrator. */
const ADMIN_LISTS: ReadonlySet<string> = new Set(['members', 'invitations'])

/** The account methods that act on the signed-in reader's own account. */
const SIGNED_IN_METHODS: ReadonlySet<string> = new Set([
  'enableTwoFactor',
  'disableTwoFactor',
  'createApiKey',
  'revokeApiKey',
  'renamePasskey',
  'removePasskey',
  'revokeSession',
  'revokeOtherSessions',
])

/** The account methods that act on another member, for an administrator only. */
const ADMIN_METHODS: ReadonlySet<string> = new Set([
  'setRole',
  'resendInvitation',
  'revokeInvitation',
])

/** The `auth` method a form runs, if it runs one. */
const authMethodOf = (component: Component): string | undefined => {
  const { action } = component as {
    readonly action?: { readonly type?: unknown; readonly method?: unknown }
  }
  return action?.type === 'auth' && typeof action.method === 'string' ? action.method : undefined
}

/** Whether the reader may run an account method at all. */
const mayRun = (method: string, app: App, session: SessionInfo | undefined): boolean => {
  if (ADMIN_METHODS.has(method))
    return session !== undefined && isAdminEquivalent(session.role, app)
  return !SIGNED_IN_METHODS.has(method) || session !== undefined
}

/** The endpoint an account list is read from. */
export const accountListEndpoint = (list: string): string => `/api/account/lists/${list}`

/** Whether a bound `dataSource` reads the reader's own sessions list. */
export const isAccountSessionsSource = (dataSource: unknown): boolean =>
  (dataSource as { readonly system?: { readonly endpoint?: unknown } } | undefined)?.system
    ?.endpoint === accountListEndpoint('sessions')

/** Bind a component's `{ auth }` source to its scoped endpoint, or withhold it (and an account form). */
export function bindAuthSource(
  component: Component,
  app: App,
  session: SessionInfo | undefined
): Component {
  const method = authMethodOf(component)
  if (method !== undefined && !mayRun(method, app, session)) return withheldComponent(component)
  const source = component.dataSource as { readonly auth?: unknown } | undefined
  const list = source?.auth
  if (typeof list !== 'string') return component
  const readable =
    session !== undefined && (!ADMIN_LISTS.has(list) || isAdminEquivalent(session.role, app))
  if (!readable) return withheldComponent(component)
  return {
    ...component,
    dataSource: {
      system: { endpoint: accountListEndpoint(list), rowsKey: 'rows' },
    } as Component['dataSource'],
  }
}

/** One list of nodes, each bound; withheld nodes leave it. Unchanged lists come back by reference. */
function bindList(
  nodes: readonly unknown[],
  app: App,
  session: SessionInfo | undefined
): readonly unknown[] {
  const bound = nodes.map((node) => bindNode(node, app, session))
  if (!bound.some((node, index) => node !== nodes[index])) return nodes
  return bound.filter((node) => !isDroppedWithheld(node))
}

/** Every `responsive.<breakpoint>.children`, bound; `undefined` when nothing changed. */
function bindResponsive(
  responsive: unknown,
  app: App,
  session: SessionInfo | undefined
): Record<string, unknown> | undefined {
  if (typeof responsive !== 'object' || responsive === null) return undefined
  const entries = Object.entries(responsive as Record<string, unknown>)
  const variants = entries.map(([, variant]) => {
    const { children } = (variant ?? {}) as { readonly children?: unknown }
    if (!Array.isArray(children)) return variant
    const bound = bindList(children, app, session)
    return bound === children
      ? variant
      : { ...(variant as Record<string, unknown>), children: bound }
  })
  if (variants.every((variant, index) => variant === entries[index]?.[1])) return undefined
  return Object.fromEntries(entries.map(([breakpoint], index) => [breakpoint, variants[index]]))
}

/** A node's `children`, bound when it has a list of them. */
const bindChildren = (children: unknown, app: App, session: SessionInfo | undefined): unknown =>
  Array.isArray(children) ? bindList(children, app, session) : children

/** One node and everything below it. A reference names a template and is left alone. */
function bindNode(node: unknown, app: App, session: SessionInfo | undefined): unknown {
  if (typeof node !== 'object' || node === null || isComponentReferenceNode(node)) return node
  const own = bindAuthSource(node as Component, app, session) as Record<string, unknown>
  if (isDroppedWithheld(own)) return own
  const { children, responsive } = own
  const nextChildren = bindChildren(children, app, session)
  const nextResponsive = bindResponsive(responsive, app, session)
  if (own === node && nextChildren === children && nextResponsive === undefined) return node
  return {
    ...own,
    ...(nextChildren === children ? {} : { children: nextChildren }),
    ...(nextResponsive === undefined ? {} : { responsive: nextResponsive }),
  }
}

/**
 * {@link bindAuthSource} over a whole component tree, wherever a list or an
 * account form sits — one container down, or inside an expanded component
 * template, which is where every settings block places its lists. It runs
 * before the data-source walk, so a nested grid is stamped for its island with
 * the scoped endpoint rather than with `{ auth }`, which the island would read
 * as a table name. A withheld node leaves its parent's children.
 */
export function bindAuthSourcesInTree<T>(
  components: readonly T[],
  app: App,
  session: SessionInfo | undefined
): readonly T[] {
  return bindList(components, app, session) as readonly T[]
}
