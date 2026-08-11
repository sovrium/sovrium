/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveAuthSecret } from '@/infrastructure/auth/auth-secret'

/**
 * The HMAC secret behind signed storage URLs.
 *
 * There are two signers — the route that mints a token
 * (`presentation/api/routes/buckets/signed-urls.ts`) and the record enricher
 * that mints one alongside a read (`tables/utils/attachment-url-enricher.ts`) —
 * and a token minted by either must verify through the other. They previously
 * kept two copies of the same expression, each ending in the same hard-coded
 * `'sovrium-signed-url-dev-secret'`. That constant was public: all of `src/` is
 * mirrored to a public repository and compiled into every shipped binary, so any
 * reader could forge a signed URL against a deployment that had not set
 * `AUTH_SECRET`.
 *
 * Resolving it once here does two things: it removes the forgeable fallback, and
 * it makes the two signers structurally incapable of drifting apart — a drift
 * whose only symptom would be download links that 403 for no visible reason.
 *
 * `env` is threaded in rather than read from `process.env` so the enricher stays
 * testable against a supplied environment.
 */
export const resolveStorageSigningSecret = (env: Readonly<NodeJS.ProcessEnv>): string =>
  env['AUTH_SECRET'] || resolveAuthSecret()
