/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  DEFAULT_PASSWORD_MIN_LENGTH,
  resolvePasswordPolicy,
} from '@/domain/models/app/auth/password-policy'
import type { App } from '@/domain/models/app'

/**
 * The render-time-only key every `form` is stamped with: the app's minimum
 * password length, the number a field that SETS a password states under it.
 */
const PASSWORD_MIN_LENGTH_KEY = '_passwordMinLength'

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The edit stamping one node, when it is a `form`, with the app's minimum
 * password length (`resolvePasswordPolicy`, the number the server enforces).
 * `stampAuthFormFacts` applies it to every node of a page. The two renderers
 * that draw a password field — the auth form and the endpoint form — read it
 * back with {@link stampedPasswordMinLength}, so the rule under a new password
 * states the configured number without the whole auth block being threaded
 * through every component on the page.
 */
export function passwordMinLengthStamp(app: App): (node: Node) => Node {
  const { minLength } = resolvePasswordPolicy(app.auth)
  return (node) =>
    node['type'] === 'form' ? { ...node, [PASSWORD_MIN_LENGTH_KEY]: minLength } : node
}

/** The minimum a form was stamped with; the documented default when it was not. */
export function stampedPasswordMinLength(component: unknown): number {
  const stamped = isRecord(component) ? component[PASSWORD_MIN_LENGTH_KEY] : undefined
  return typeof stamped === 'number' ? stamped : DEFAULT_PASSWORD_MIN_LENGTH
}
