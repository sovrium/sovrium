/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The app-variables contract `sovrium env` speaks to a Sovrium Cloud.
 *
 * An app's environment variables — a payment key, a webhook token — live in
 * the cloud, never in the bundle: a bundle is kept per deployment for
 * rollback, so a secret inside one would outlive its rotation. The cloud
 * writes them into the app's environment on its next deployment.
 *
 * Like the deploy contract, no route of the engine serves it: the cloud is an
 * ordinary Sovrium app declaring one session webhook, `POST
 * /api/automations/app-env/webhook?app=<id>` (the app's id; the caller's API
 * key as `x-api-key`; 404 `unknown-app` for an app that is not the caller's,
 * an admin's call included). It takes two bodies, both answered
 * {@link appEnvResultsResponseSchema}, one result per name:
 *
 * - {@link appEnvBatchRequestSchema} — set several variables;
 * - {@link appEnvUnsetRequestSchema} — remove some.
 *
 * Listing is the app-address lookup's: its `env` names each variable with its
 * kind, never a value.
 */

/** An environment variable name: capital letters, digits and `_`, starting with a letter. */
export const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/

/**
 * Names the platform sets itself — the engine's own switches, the app's
 * address and secrets, error tracking, the database and storage. A push drops
 * them with a note and never sends them; the cloud refuses them too.
 *
 * @public
 */
export const PLATFORM_ENV_NAME_PATTERN =
  /^(?:SOVRIUM_.*|PORT|HOSTNAME|BASE_URL|NODE_ENV|AUTH_SECRET|AUTH_ADMIN_.*|SENTRY_.*|OTEL_.*|DATABASE_URL|DATABASE_POOL_MAX|STORAGE_.*)$/

/**
 * Why a value cannot be stored as written: an empty value is refused by the
 * cloud, and the app's environment file holds
 * one line per variable, and the reader of that file drops a backslash,
 * strips a quote around a value and trims blanks at its ends. A value with
 * any of these would reach the app altered, so it is refused before anything
 * is sent. `undefined` for a value that arrives unchanged.
 *
 * @public
 */
export const envValueProblem = (value: string): string | undefined => {
  if (value === '') return 'it is empty'
  if (/[\r\n]/.test(value)) return 'it spans more than one line'
  if (value.includes('\\')) return 'it holds a backslash'
  if (/^['"]/.test(value)) return 'it starts with a quote'
  if (/^\s|\s$/.test(value)) return 'it starts or ends with a blank'
  return undefined
}

const envNameSchema = Schema.String.annotate({
  description: 'Variable name: capital letters, digits and _, starting with a letter',
}).check(Schema.isPattern(ENV_VAR_NAME_PATTERN))

/** One variable to set. A variable is secret unless `secret: false`. @public */
export const appEnvVarSchema = Schema.Struct({
  name: envNameSchema,
  value: Schema.String.annotate({
    description: 'The value, sent once and never shown back',
  }),
  secret: optionalField(
    Schema.Boolean.annotate({
      description:
        'false: a plain value the owner can read; true or absent: a secret only the operator can read once saved',
    })
  ),
})

/** @public */
export type AppEnvVar = Schema.Schema.Type<typeof appEnvVarSchema>

/**
 * Body of a push: every variable to set, and whether an existing variable of
 * the same name is replaced (`overwrite: true`) or left as it is (absent or
 * false, the default).
 *
 * @public
 */
export const appEnvBatchRequestSchema = Schema.Struct({
  vars: Schema.Array(appEnvVarSchema)
    .annotate({ description: 'The variables to set, at least one' })
    .check(Schema.isMinLength(1)),
  overwrite: optionalField(
    Schema.Boolean.annotate({
      description:
        'true: a variable already set is replaced; absent or false: it is left unchanged and reported as such',
    })
  ),
})

/** @public */
export type AppEnvBatchRequest = Schema.Schema.Type<typeof appEnvBatchRequestSchema>

/** Body of a removal: the variables to remove, by name. @public */
export const appEnvUnsetRequestSchema = Schema.Struct({
  unset: Schema.Array(envNameSchema)
    .annotate({ description: 'The variables to remove, at least one' })
    .check(Schema.isMinLength(1)),
})

/** @public */
export type AppEnvUnsetRequest = Schema.Schema.Type<typeof appEnvUnsetRequestSchema>

/**
 * What happened to one name: for a push, `added` (it was not set),
 * `unchanged` (it was set and the push did not overwrite), `replaced` (it was
 * set and the push overwrote it) or `refused` (`reason` says why); for a
 * removal, `removed` or `absent` (it was not set).
 *
 * @public
 */
export const appEnvResultValues = [
  'added',
  'unchanged',
  'replaced',
  'refused',
  'removed',
  'absent',
] as const

/**
 * Why the cloud refused to store a variable.
 *
 * @public
 */
export const appEnvRefusalReasons = [
  'reserved-name',
  'invalid-name',
  'empty-value',
  'invalid-value',
  'duplicate',
] as const

/** @public */
export const appEnvResultSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The variable, by name' }),
  result: Schema.Literals(appEnvResultValues).annotate({
    description: "'added', 'unchanged', 'replaced', 'refused', 'removed' or 'absent'",
  }),
  reason: optionalField(
    Schema.String.annotate({
      description:
        "Why a variable was refused: 'reserved-name', 'invalid-name', 'empty-value', 'invalid-value' or 'duplicate' (a newer cloud may add one); absent otherwise",
    })
  ),
})

/** @public */
export type AppEnvResult = Schema.Schema.Type<typeof appEnvResultSchema>

/** `200`: one result per name, in the order sent. @public */
export const appEnvResultsResponseSchema = Schema.Struct({
  results: Schema.Array(appEnvResultSchema).annotate({
    description: 'One result per name, in the order sent; never a value',
  }),
})

/** @public */
export type AppEnvResultsResponse = Schema.Schema.Type<typeof appEnvResultsResponseSchema>

/**
 * Body of a redeploy — the cloud's rollback path, `POST
 * /api/automations/deployment-rollback/webhook`: a new deployment of an
 * earlier one's bundle, no upload. `sovrium env push --redeploy` names the
 * app's live deployment, so its variables reach it at once.
 *
 * @public
 */
export const redeployRequestSchema = Schema.Struct({
  deploymentId: Schema.String.annotate({
    description: 'The deployment whose bundle is deployed again',
  }).check(Schema.isMinLength(1)),
})

/** `201`: the new deployment, queued. @public */
export const redeployResponseSchema = Schema.Struct({
  deploymentId: Schema.String.annotate({ description: 'Id of the new deployment' }).check(
    Schema.isMinLength(1)
  ),
  status: Schema.String.annotate({ description: 'Its first state, usually queued' }),
  rollbackOf: optionalField(
    Schema.String.annotate({ description: 'The deployment whose bundle it reuses' })
  ),
})

/** @public */
export type RedeployResponse = Schema.Schema.Type<typeof redeployResponseSchema>
