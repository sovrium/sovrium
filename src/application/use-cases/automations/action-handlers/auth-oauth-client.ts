/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `auth/registerOAuthClient`, `auth/rotateOAuthClientSecret` and
 * `auth/deleteOAuthClient` — the sign-in clients of the app's own OpenID
 * Connect provider, managed from a workflow: the client a platform registers
 * for every app it hosts, so that app's admins sign in with their platform
 * account.
 *
 * The client's shape is fixed by the port (`OAuthClientRegistrar`); the only
 * choices are its name and its one return address, checked here before
 * anything is written. The secret travels in the step's output to the next
 * step, and is recorded as `***` (`secret-props.ts`).
 *
 * Failure semantics: a refused address, an unknown client to rotate, or a
 * provider error is a `status: 'failure'` outcome — the run fails and the
 * webhook answers 500, so the caller is never told a client exists that does
 * not. Deleting a client that is not there succeeds with `deleted: false`.
 */

import { Effect, Option } from 'effect'
import { OAuthClientRegistrar } from '@/application/ports/services/oauth-client-registrar'
import { signInClientRedirectProblem } from '@/domain/models/app/automations/actions/auth/oauth-client-validation'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

/** A failed step, saying what was refused. */
const failure = (error: string): ActionOutcome => ({ status: 'failure', error, retryable: false })

/** The provider's error, logged with its cause; the step says only that it failed. */
const providerFailure = (operator: string) => (cause: unknown) =>
  Effect.sync(() => {
    logError(`[automations] auth.${operator} failed`, cause)
    return { status: 'failure', error: `auth.${operator}: the sign-in provider refused` } as const
  })

/** `auth/registerOAuthClient` — register a sign-in client for one other app. */
export const handleAuthRegisterOAuthClient: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const props = propsOf(action)
    const name = stringProp(props, 'name').trim()
    const redirectUri = stringProp(props, 'redirectUri').trim()
    if (name === '') return failure('auth.registerOAuthClient requires a non-empty `name`')
    const problem = signInClientRedirectProblem(redirectUri)
    if (problem !== undefined) return failure(`auth.registerOAuthClient: redirectUri ${problem}`)
    const registrar = yield* OAuthClientRegistrar
    const client = yield* registrar.register(app.auth, { name, redirectUri })
    return {
      status: 'success',
      output: { clientId: client.clientId, clientSecret: client.clientSecret },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.catchTag('OAuthClientError', ({ cause }) =>
      providerFailure('registerOAuthClient')(cause)
    ),
    Effect.withSpan('automations.handle-auth-register-oauth-client', {
      attributes: actionAttributes(action),
    })
  )

/** `auth/rotateOAuthClientSecret` — replace a registered client's secret. */
export const handleAuthRotateOAuthClientSecret: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const clientId = stringProp(propsOf(action), 'clientId').trim()
    if (clientId === '') {
      return failure('auth.rotateOAuthClientSecret requires a non-empty `clientId`')
    }
    const registrar = yield* OAuthClientRegistrar
    const rotated = yield* registrar.rotateSecret(app.auth, clientId)
    if (Option.isNone(rotated)) {
      return failure(`auth.rotateOAuthClientSecret: no sign-in client '${clientId}'`)
    }
    return {
      status: 'success',
      output: { clientId, clientSecret: rotated.value.clientSecret },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.catchTag('OAuthClientError', ({ cause }) =>
      providerFailure('rotateOAuthClientSecret')(cause)
    ),
    Effect.withSpan('automations.handle-auth-rotate-oauth-client-secret', {
      attributes: actionAttributes(action),
    })
  )

/** `auth/deleteOAuthClient` — delete a registered client; its tokens stop working. */
export const handleAuthDeleteOAuthClient: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const clientId = stringProp(propsOf(action), 'clientId').trim()
    if (clientId === '') return failure('auth.deleteOAuthClient requires a non-empty `clientId`')
    const registrar = yield* OAuthClientRegistrar
    const deleted = yield* registrar.remove(app.auth, clientId)
    return { status: 'success', output: { clientId, deleted } } as const satisfies ActionOutcome
  }).pipe(
    Effect.catchTag('OAuthClientError', ({ cause }) => providerFailure('deleteOAuthClient')(cause)),
    Effect.withSpan('automations.handle-auth-delete-oauth-client', {
      attributes: actionAttributes(action),
    })
  )
