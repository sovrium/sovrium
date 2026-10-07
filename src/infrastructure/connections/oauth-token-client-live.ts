/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  OAuthTokenClient,
  OAuthTokenTransportError,
} from '@/application/ports/services/oauth-token-client'
import { exchangeMetaLongLivedToken } from './long-lived-token-exchange'
import { requestExchangedToken } from './token-exchange-request'
import {
  refreshAccessToken,
  requestClientCredentialsToken,
  withRefreshLockEffect,
} from './token-refresh'

const transport = <A>(thunk: () => Promise<A>): Effect.Effect<A, OAuthTokenTransportError> =>
  Effect.tryPromise({ try: thunk, catch: (cause) => new OAuthTokenTransportError({ cause }) })

/** Live `OAuthTokenClient` — the SSRF-guarded, timeout-bounded token requests and the refresh lock. */
export const OAuthTokenClientLive = Layer.succeed(
  OAuthTokenClient,
  OAuthTokenClient.of({
    refreshAccessToken: (props, refreshToken) =>
      transport(() => refreshAccessToken(props, refreshToken)),
    requestClientCredentialsToken: (props) => transport(() => requestClientCredentialsToken(props)),
    exchangeLongLivedToken: (props, currentToken) =>
      transport(() => exchangeMetaLongLivedToken(props, currentToken)),
    requestExchangedToken: (request) => transport(() => requestExchangedToken(request)),
    withRefreshLock: withRefreshLockEffect,
  })
)
