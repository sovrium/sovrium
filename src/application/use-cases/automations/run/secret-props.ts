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
 * A `browser/run`'s steps as recorded: the value of a step marked `sensitive`
 * is masked. A `$env` value is recorded as the reference it is written as, and
 * a one-time code as its `{{totp …}}` template — neither is a secret.
 */
const maskSensitiveSteps = (steps: unknown): unknown =>
  Array.isArray(steps)
    ? steps.map((step: unknown) =>
        typeof step === 'object' &&
        step !== null &&
        (step as Readonly<Record<string, unknown>>)['sensitive'] === true
          ? { ...(step as Readonly<Record<string, unknown>>), value: SECRET_MASK }
          : step
      )
    : steps

const maskProp = (identity: ActionIdentity, prop: string, value: unknown): unknown => {
  if (isSecretValuedProp(identity, prop)) return maskValues(value)
  if (identity.type === 'browser' && identity.operator === 'run' && prop === 'steps') {
    return maskSensitiveSteps(value)
  }
  return value
}

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
    Object.entries(props).map(([prop, value]) => [prop, maskProp(identity, prop, value)])
  )

/**
 * Outputs whose named keys are secrets by their place in the action: the
 * client secret a sign-in client step answers. The step's live output keeps
 * it — the next step stores it where the workflow means it to go — but the
 * recorded run shows the client id and `***`.
 */
const SECRET_OUTPUT_KEYS: Readonly<Record<string, readonly string[]>> = {
  'auth/registerOAuthClient': ['clientSecret'],
  'auth/rotateOAuthClientSecret': ['clientSecret'],
}

/** The output keys of `identity`'s action that are secrets. */
export const secretOutputKeys = (identity: ActionIdentity): readonly string[] =>
  SECRET_OUTPUT_KEYS[`${identity.type}/${identity.operator ?? ''}`] ?? []

/**
 * The output a step record keeps, with every secret-valued key replaced by
 * {@link SECRET_MASK}. Runs on the persisted copy only.
 */
export const maskSecretOutput = (
  identity: ActionIdentity,
  output: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const keys = secretOutputKeys(identity)
  return keys.length === 0
    ? output
    : Object.fromEntries(
        Object.entries(output).map(([key, value]) => [
          key,
          keys.includes(key) && value !== undefined ? SECRET_MASK : value,
        ])
      )
}

/**
 * The secrets the steps a run has recorded so far answered, read from their
 * live outputs (`outputs`, by step name) at the keys {@link secretOutputKeys}
 * names. A later step that carries one on — the step storing the client secret
 * where the workflow keeps it, say — has it masked in its own record too.
 */
export const runSecretValues = (
  steps: ReadonlyArray<ActionIdentity>,
  outputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): readonly string[] =>
  steps.flatMap((step) =>
    secretOutputKeys(step).flatMap((key) => {
      const value = outputs[step.name]?.[key]
      return typeof value === 'string' && value !== '' ? [value] : []
    })
  )
