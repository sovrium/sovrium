/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mountHref } from '@/domain/models/app/admin/mount-hrefs'
import { passwordResetLandingPath } from '@/domain/models/app/pages/page-requires'
import { getMountBasePath } from '@/infrastructure/css/mount-identity'
import { passwordMinLengthStamp } from './password-policy-stamp'
import type { App } from '@/domain/models/app'

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * `value` with `edit` applied to every object under it, children first, at any
 * depth and inside any slot; the same reference wherever nothing changed.
 */
const stampTree = (value: unknown, edit: (node: Node) => Node): unknown => {
  if (Array.isArray(value)) {
    const next = value.map((item) => stampTree(item, edit))
    return next.every((item, index) => item === value[index]) ? value : next
  }
  if (!isRecord(value)) return value
  const entries = Object.entries(value)
  const stamped = entries.map(([key, child]) => [key, stampTree(child, edit)] as const)
  const base = stamped.every(([, child], index) => child === entries[index]?.[1])
    ? value
    : Object.fromEntries(stamped)
  return edit(base)
}

/** `path` under the mount serving `app`, or as written when no mount serves it. */
export function servingMountHref(app: App, path: string): string {
  const basePath = getMountBasePath(app)
  return basePath === undefined ? path : mountHref(basePath, path)
}

/** A form asking for a password-reset link (`auth` / `resetPassword`). */
const isResetRequestForm = (node: Node): boolean => {
  const { action } = node
  return (
    node['type'] === 'form' &&
    isRecord(action) &&
    action['type'] === 'auth' &&
    action['method'] === 'resetPassword'
  )
}

/**
 * The page a reset link opens, read once per app: the answer walks every page,
 * and a document stamps both its page and the app's templates on each render.
 */
const resetLandingByApp = new WeakMap<App, string>()
const resetLandingOf = (app: App): string => {
  const known = resetLandingByApp.get(app)
  if (known !== undefined) return known
  const landing = servingMountHref(app, passwordResetLandingPath(app))
  resetLandingByApp.set(app, landing)
  return landing
}

/**
 * The edit stamping a form asking for a password-reset link with the page the
 * emailed link must open (`action._resetLanding`): the app's page drawing a
 * `setNewPassword` form, else the documented default, under the mount serving
 * the app. The auth form sends it as the request's `redirectTo`, which is where
 * Better Auth sends the reader with the token.
 */
function resetLandingStamp(app: App): (node: Node) => Node {
  const landing = resetLandingOf(app)
  return (node) =>
    isResetRequestForm(node)
      ? { ...node, action: { ...(node['action'] as Node), _resetLanding: landing } }
      : node
}

/**
 * The two render-time facts an auth form reads off the apps around it, stamped
 * in one walk by the page document assembly: the password minimum of
 * `policyApp` (the app whose accounts the page changes) on every form, and the
 * page of `app` a reset link opens on every reset request form.
 *
 * Applied to the page AND to the app's templates, so a form placed through a
 * template (`component:` / `$ref`) is stamped as well.
 */
export function stampAuthFormFacts<T>(components: T, policyApp: App, app: App): T {
  const withMinLength = passwordMinLengthStamp(policyApp)
  const withResetLanding = resetLandingStamp(app)
  return stampTree(components, (node) => withResetLanding(withMinLength(node))) as T
}
