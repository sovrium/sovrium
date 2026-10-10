/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sign-in clients of the app's own OpenID Connect provider, as the
 * `auth/registerOAuthClient`, `auth/rotateOAuthClientSecret` and
 * `auth/deleteOAuthClient` steps see them.
 *
 * A client registered here has one fixed shape — confidential, consent
 * skipped, PKCE required, the authorization code only, `openid email profile`
 * only, one exact return address — and is never a client of the app's MCP
 * server. Rotating and deleting reach only the clients registered here.
 *
 * Like `ConfigAccountProvisioner`, it takes the app's auth CONFIG rather than a
 * running engine: the steps run from the cron scheduler and the record-event
 * dispatcher as well as from a request.
 */

import { Context, Data, type Effect, type Option } from 'effect'
import type { Auth } from '@/domain/models/app/auth'

/** The provider refused the write or could not be reached. `cause` is its own error. */
export class OAuthClientError extends Data.TaggedError('OAuthClientError')<{
  readonly cause: unknown
}> {}

/** A client and the secret it authenticates with, shown once. */
export interface SignInClientCredentials {
  readonly clientId: string
  readonly clientSecret: string
}

export class OAuthClientRegistrar extends Context.Service<
  OAuthClientRegistrar,
  {
    /** Register one client for `redirectUri`, already checked by the caller. */
    readonly register: (
      authConfig: Auth | undefined,
      client: { readonly name: string; readonly redirectUri: string }
    ) => Effect.Effect<SignInClientCredentials, OAuthClientError>
    /** Replace a registered client's secret; `none` when no such client was registered here. */
    readonly rotateSecret: (
      authConfig: Auth | undefined,
      clientId: string
    ) => Effect.Effect<Option.Option<SignInClientCredentials>, OAuthClientError>
    /** Delete a registered client; `false` when there was none to delete. */
    readonly remove: (
      authConfig: Auth | undefined,
      clientId: string
    ) => Effect.Effect<boolean, OAuthClientError>
  }
>()('OAuthClientRegistrar') {}
