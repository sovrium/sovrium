/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { resolveIdleExitSeconds } from './server-lifecycle'

/**
 * Server environment configuration.
 *
 * Env vars: PORT, BASE_URL
 */
export const ServerEnvSchema = Schema.Struct({
  port: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(65_535)
      ),
      Schema.annotate({ description: 'Server port (PORT)', examples: [3000] })
    )
  ),
  baseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^https?:\/\/.+/)),
      Schema.annotate({
        description: 'Base URL of the application (BASE_URL)',
        examples: ['http://localhost:3000'],
      })
    )
  ),
})

/** A read-only `process.env`-shaped map. */
type EnvRecord = Readonly<Record<string, string | undefined>>

/** The port the server is asked for when `PORT` is unset or empty. */
const DEFAULT_PORT = '3000'

/**
 * `BASE_URL` as the operator declared it, without trailing slashes, or
 * `undefined` when it is unset or empty.
 *
 * The one rule every reader of `BASE_URL` shares: an empty value means "not
 * set" (an operator who writes `BASE_URL=` in a `.env` file declared nothing),
 * and a trailing slash is never part of the origin, so a caller appends a path
 * directly. Better Auth's `baseURL`, the passkey relying party, the server's
 * own origin, the loopback fallbacks and the canonical-host redirect all read
 * it through here.
 */
export const declaredBaseUrl = (env: EnvRecord): string | undefined => {
  const declared = env['BASE_URL']
  return declared === undefined || declared === '' ? undefined : declared.replace(/\/+$/, '')
}

/**
 * The origin this instance names before it has bound a socket:
 * {@link declaredBaseUrl}, else `http://localhost:${PORT}` (`3000` when `PORT`
 * is unset or empty).
 *
 * This is the address Better Auth is built with and the MCP resource identity
 * derives from, and the last fallback of the server's own origin. It is
 * deliberately NOT the bound origin: every Better Auth instance is built
 * before the listener binds, and the token audience and issuer an instance
 * mints must stay equal to the ones the MCP endpoint later expects, whenever
 * either is computed.
 */
export const preBindOrigin = (env: EnvRecord): string =>
  declaredBaseUrl(env) ?? `http://localhost:${env['PORT'] || DEFAULT_PORT}`

/**
 * `SOVRIUM_PREVIEW_TOKEN`, or `undefined` when it is unset or empty. A secret:
 * a caller compares it and never prints it.
 */
export const declaredPreviewToken = (env: EnvRecord): string | undefined => {
  const token = env['SOVRIUM_PREVIEW_TOKEN']
  return token === undefined || token === '' ? undefined : token
}

/**
 * The server's environment, read once at boot: the values a running server
 * consults over and over, decoded through the rules above so every consumer
 * reads the same answer.
 *
 * Holds the preview token, a secret: the record is never logged whole.
 */
export interface ServerEnvValues {
  /** {@link declaredBaseUrl}. */
  readonly baseUrl: string | undefined
  /** {@link preBindOrigin}. */
  readonly preBindOrigin: string
  /** `PORT` as written, or `undefined` when unset or empty. */
  readonly port: string | undefined
  /** {@link declaredPreviewToken}. */
  readonly previewToken: string | undefined
  /** `SOVRIUM_IDLE_EXIT_SECONDS`, or `undefined` (never exit, or a value the boot gate refuses). */
  readonly idleExitSeconds: number | undefined
}

/** Decode {@link ServerEnvValues} from an environment snapshot. Never throws. */
export const parseServerEnv = (env: EnvRecord): ServerEnvValues => ({
  baseUrl: declaredBaseUrl(env),
  preBindOrigin: preBindOrigin(env),
  port: env['PORT'] === '' ? undefined : env['PORT'],
  previewToken: declaredPreviewToken(env),
  idleExitSeconds: resolveIdleExitSeconds(env),
})
