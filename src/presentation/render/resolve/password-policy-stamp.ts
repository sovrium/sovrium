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

/** `value` with every form under it stamped; the same reference wherever nothing changed. */
const stamp = (value: unknown, minLength: number): unknown => {
  if (Array.isArray(value)) {
    const next = value.map((item) => stamp(item, minLength))
    return next.every((item, index) => item === value[index]) ? value : next
  }
  if (!isRecord(value)) return value
  const entries = Object.entries(value)
  const stamped = entries.map(([key, child]) => [key, stamp(child, minLength)] as const)
  const base = stamped.every(([, child], index) => child === entries[index]?.[1])
    ? value
    : Object.fromEntries(stamped)
  return value['type'] === 'form' ? { ...base, [PASSWORD_MIN_LENGTH_KEY]: minLength } : base
}

/**
 * Stamp every `form` under `components`, at any depth and inside any slot, with
 * the app's minimum password length (`resolvePasswordPolicy`, the number the
 * server enforces). The two renderers that draw a password field — the auth
 * form and the endpoint form — read it back with {@link stampedPasswordMinLength},
 * so the rule under a new password states the configured number without the
 * whole auth block being threaded through every component on the page.
 */
export function stampPasswordMinLength<T>(components: T, app: App): T {
  return stamp(components, resolvePasswordPolicy(app.auth).minLength) as T
}

/** The minimum a form was stamped with; the documented default when it was not. */
export function stampedPasswordMinLength(component: unknown): number {
  const stamped = isRecord(component) ? component[PASSWORD_MIN_LENGTH_KEY] : undefined
  return typeof stamped === 'number' ? stamped : DEFAULT_PASSWORD_MIN_LENGTH
}
