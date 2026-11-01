/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { mountHref } from '@/domain/models/app/admin/mount-hrefs'
import { passwordResetLandingPath } from '@/domain/models/app/pages/page-requires'
import { isOutgoingEmailConfigured } from '@/domain/models/process-env/email-transport'
import { getMountBasePath } from '@/infrastructure/css/mount-identity'
import { passwordMinLengthStamp } from './password-policy-stamp'
import type { App } from '@/domain/models/app'

type Node = Readonly<Record<string, unknown>>

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

/** A sign-in form (`auth` / `login`, the default method) declaring `credentialError`. */
const credentialErrorOf = (node: Node): Node | undefined => {
  const { action } = node
  if (node['type'] !== 'form' || !isRecord(action) || action['type'] !== 'auth') return undefined
  if ((action['method'] ?? 'login') !== 'login') return undefined
  const declared = action['credentialError']
  return isRecord(declared) ? declared : undefined
}

/**
 * The edit stamping a sign-in form declaring `credentialError` with the refusal
 * THIS instance draws (`action._credentialError`): the title, then
 * `description` and the `recovery` link where a reset mail can leave, or
 * `descriptionWithoutMail` (else `description`) and no link where it cannot,
 * since a link to a form that sends nothing is a dead end. Resolved here, on
 * the server, because whether mail can leave is a fact about the deployment
 * that the config does not hold and the island must never read (S4).
 */
export function credentialErrorStamp(canSendMail: boolean): (node: Node) => Node {
  return (node) => {
    const declared = credentialErrorOf(node)
    if (declared === undefined) return node
    const description = canSendMail
      ? declared['description']
      : (declared['descriptionWithoutMail'] ?? declared['description'])
    const resolved = {
      title: declared['title'],
      ...(description !== undefined && { description }),
      ...(canSendMail && declared['recovery'] !== undefined && { recovery: declared['recovery'] }),
    }
    return { ...node, action: { ...(node['action'] as Node), _credentialError: resolved } }
  }
}

/**
 * The render-time facts an auth form reads off the apps and the deployment
 * around it, stamped in one walk by the page document assembly: the password
 * minimum of `policyApp` (the app whose accounts the page changes) on every
 * form, the page of `app` a reset link opens on every reset request form, and
 * the refusal a sign-in form declaring `credentialError` draws on this
 * instance, which may or may not send mail.
 *
 * Applied to the page AND to the app's templates, so a form placed through a
 * template (`component:` / `$ref`) is stamped as well.
 */
export function stampAuthFormFacts<T>(components: T, policyApp: App, app: App): T {
  const withMinLength = passwordMinLengthStamp(policyApp)
  const withResetLanding = resetLandingStamp(app)
  const withCredentialError = credentialErrorStamp(isOutgoingEmailConfigured(process.env))
  return stampTree(components, (node) =>
    withCredentialError(withResetLanding(withMinLength(node)))
  ) as T
}
