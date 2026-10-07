/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ActionIdentity } from './action-identity'

/** What a masked prop value is recorded as — the mark the env redaction paints. */
export const SECRET_MASK = '***'

/**
 * Props whose every value is a secret by its place in the action, not by its
 * value: a `file/upload` step's `headers` carry the credentials of the source,
 * and an inline key or a templated value matches no declared secret, so the
 * value-based redaction cannot find them. The header NAMES stay readable.
 */
const isSecretValuedProp = (identity: ActionIdentity, prop: string): boolean =>
  identity.type === 'file' && identity.operator === 'upload' && prop === 'headers'

const maskValues = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).map((key) => [key, SECRET_MASK]))
    : SECRET_MASK

/**
 * The props a step record keeps, with every value of a secret-valued prop
 * replaced by {@link SECRET_MASK}. Runs on the persisted copy only; the
 * action itself was dispatched with the real values.
 */
export const maskSecretProps = (
  identity: ActionIdentity,
  props: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(props).map(([prop, value]) => [
      prop,
      isSecretValuedProp(identity, prop) ? maskValues(value) : value,
    ])
  )
