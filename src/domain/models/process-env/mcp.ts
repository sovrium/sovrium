/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * MCP environment configuration.
 *
 * Mounts the MCP server route, picks transport, sets rate limits, and toggles
 * audit + admin internals exposure.
 *
 * Authentication is NOT configured here. `/mcp` dispatches on the header a
 * request carries — `x-api-key` to the API-key verifier, `Authorization:
 * Bearer` to the OAuth resource server — so there is no strategy to select and
 * no credential to declare. Both are Better Auth plugins, which is why
 * `MCP_ENABLED=true` requires `app.auth`.
 *
 * Following the env-var pattern established by DATABASE_URL, STORAGE_PROVIDER,
 * AUTH_SECRET, and AI_PROVIDER: infrastructure concerns are operator
 * config (env vars), schema-author concerns are app/business intent (declared
 * in `app.tables[].aiAccess`, `app.automations[].aiAccess`, etc.).
 *
 * Default: MCP_ENABLED=false. Operator must explicitly opt in.
 *
 * Env vars:
 *   MCP_ENABLED, MCP_TRANSPORT, MCP_MOUNT_PATH,
 *   MCP_RATE_LIMIT_PER_MINUTE, MCP_RATE_LIMIT_PER_DAY,
 *   MCP_AUDIT_ENABLED, MCP_EXPOSE_INTERNALS, MCP_CONFIRM_DESTRUCTIVE
 *
 * Retired (refused at boot when MCP_ENABLED=true — see `validateMcpEnv`):
 *   MCP_TOKEN_ADMIN, MCP_TOKEN_MEMBER, MCP_TOKEN_VIEWER,
 *   MCP_AUTH_STRATEGY=token
 */

// ---------------------------------------------------------------------------
// Helper: BooleanFromString — env vars are always strings
// ---------------------------------------------------------------------------

// EFFECT 4: `Schema.transform(from, to, {strict, decode, encode})` ->
// `from.pipe(Schema.decodeTo(to, {decode, encode}))` with each side a
// `SchemaGetter` (migration/v3-to-v4.md:14284); `strict` no longer exists.
const BooleanFromString = Schema.Literals(['true', 'false', 'TRUE', 'FALSE', '1', '0']).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(
      (s: 'true' | 'false' | 'TRUE' | 'FALSE' | '1' | '0') =>
        s === 'true' || s === 'TRUE' || s === '1'
    ),
    encode: SchemaGetter.transform((b: boolean) => (b ? ('true' as const) : ('false' as const))),
  })
)

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const McpTransportSchema = Schema.Literals(['stdio', 'streamable-http'])
export type McpTransport = typeof McpTransportSchema.Type

export const McpEnvSchema = Schema.Struct({
  enabled: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotate({
        description:
          'Master switch — server only mounts the /mcp route when true (MCP_ENABLED). Default: false.',
      })
    )
  ),
  transport: Schema.optional(
    McpTransportSchema.pipe(
      Schema.annotate({
        description:
          'Transport choice (MCP_TRANSPORT). streamable-http for remote clients (Claude Desktop, ChatGPT Dev Mode), stdio for local IDE integration. Default: streamable-http.',
      })
    )
  ),
  mountPath: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^\/[a-z0-9\-/]*$/)),
      Schema.annotate({
        description:
          'Hono route prefix when transport=streamable-http (MCP_MOUNT_PATH). Default: /mcp.',
      })
    )
  ),
  rateLimitPerMinute: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Per-token requests per minute (MCP_RATE_LIMIT_PER_MINUTE). Default: 60.',
      })
    )
  ),
  rateLimitPerDay: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Per-token requests per day (MCP_RATE_LIMIT_PER_DAY). Default: 5000.',
      })
    )
  ),
  auditEnabled: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotate({
        description:
          'Log every tool call to system.ai_tool_calls + activity stream (MCP_AUDIT_ENABLED). Default: true. Disabling is permitted for compliance edge cases but strongly discouraged.',
      })
    )
  ),
  exposeInternals: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotate({
        description:
          'Expose auth + system pgSchema tables read-only to admin role (MCP_EXPOSE_INTERNALS). Default: true. Toggle to false to remove all internal tools from tools/list, including for admins.',
      })
    )
  ),
  confirmDestructive: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotate({
        description:
          'Compile destructiveHint=true onto delete tools and non-idempotent automations (MCP_CONFIRM_DESTRUCTIVE). Default: true. Affects client UX (auto-approve vs. confirm).',
      })
    )
  ),
})

export type McpEnvConfig = Schema.Schema.Type<typeof McpEnvSchema>

// ---------------------------------------------------------------------------
// Defaults — applied after decode for fields the operator did not set
// ---------------------------------------------------------------------------

export const MCP_ENV_DEFAULTS = {
  enabled: false,
  transport: 'streamable-http' as const,
  mountPath: '/mcp',
  rateLimitPerMinute: 60,
  rateLimitPerDay: 5000,
  auditEnabled: true,
  exposeInternals: true,
  confirmDestructive: true,
} as const

// ---------------------------------------------------------------------------
// Resolve helper — applies defaults, returns a fully-populated config
// ---------------------------------------------------------------------------

export type ResolvedMcpEnvConfig = {
  readonly enabled: boolean
  readonly transport: McpTransport
  readonly mountPath: string
  readonly rateLimitPerMinute: number
  readonly rateLimitPerDay: number
  readonly auditEnabled: boolean
  readonly exposeInternals: boolean
  readonly confirmDestructive: boolean
}

export const resolveMcpEnv = (parsed: McpEnvConfig): ResolvedMcpEnvConfig => ({
  enabled: parsed.enabled ?? MCP_ENV_DEFAULTS.enabled,
  transport: parsed.transport ?? MCP_ENV_DEFAULTS.transport,
  mountPath: parsed.mountPath ?? MCP_ENV_DEFAULTS.mountPath,
  rateLimitPerMinute: parsed.rateLimitPerMinute ?? MCP_ENV_DEFAULTS.rateLimitPerMinute,
  rateLimitPerDay: parsed.rateLimitPerDay ?? MCP_ENV_DEFAULTS.rateLimitPerDay,
  auditEnabled: parsed.auditEnabled ?? MCP_ENV_DEFAULTS.auditEnabled,
  exposeInternals: parsed.exposeInternals ?? MCP_ENV_DEFAULTS.exposeInternals,
  confirmDestructive: parsed.confirmDestructive ?? MCP_ENV_DEFAULTS.confirmDestructive,
})

// ---------------------------------------------------------------------------
// Validation — startup checks beyond decode (cross-field rules)
// ---------------------------------------------------------------------------

/** Env vars retired by [internal ref], and the names an operator will recognise. */
const RETIRED_TOKEN_VARS = ['MCP_TOKEN_ADMIN', 'MCP_TOKEN_MEMBER', 'MCP_TOKEN_VIEWER'] as const

/**
 * Cross-rule validation that cannot be expressed inside the decode schema.
 * Run at server startup *after* decode succeeds. Returns `undefined` when the
 * config is valid, or a human-readable error message when it is not; the
 * caller decides how to surface it (throwing at startup is the typical
 * choice).
 *
 * Every rule below is scoped to `MCP_ENABLED=true`, deliberately. A retired
 * var on an instance that never mounts `/mcp` authorizes nothing, and failing
 * a whole app's boot over an inert string would be hostile. `MCP_ENABLED`
 * defaults to `false`, so the blast radius is exactly the instances that opted
 * in — and those operators need to act, not to read a warning.
 *
 * The three rules:
 *
 *  1. **A still-set `MCP_TOKEN_*` refuses the boot.** These are read off the
 *     RAW env rather than off the decoded config, because the fields no longer
 *     exist on the schema at all: keeping them just to reject them would fail a
 *     short leftover with a message about a length constraint on a var that no
 *     longer means anything. Silently ignoring them is the worst available
 *     outcome — the operator believes `/mcp` is authenticated by the secret
 *     they issued when it is authenticated by something else entirely. A
 *     refusal puts the failure where the change was made.
 *  2. **`MCP_AUTH_STRATEGY=token` refuses the boot**, for the same reason and
 *     with the same scoping. `oauth2` is accepted as a documented no-op: it
 *     asks for what it now always gets, so refusing a correct config would be
 *     gratuitous.
 *  3. **`MCP_ENABLED=true` requires `app.auth`.** Both surviving credentials
 *     are Better Auth plugins, so an app without `app.auth` offers no way for
 *     anyone to authenticate to `/mcp`; leaving the route open on such an
 *     instance is strictly worse than the tokens it replaces. The message keeps
 *     naming `app.auth` — this rule subsumes the former
 * `oauth2 && !authConfigured` branch that [internal ref] pins.
 */
export const validateMcpEnv = (
  config: ResolvedMcpEnvConfig,
  context?: {
    readonly authConfigured?: boolean
    readonly env?: NodeJS.ProcessEnv
  }
): string | undefined => {
  if (!config.enabled) return undefined

  const env = context?.env
  const stillSet = env === undefined ? [] : RETIRED_TOKEN_VARS.filter((name) => env[name])
  if (stillSet.length > 0) {
    return `${stillSet.join(', ')} is set, but the MCP static tokens were removed. They had no user identity, so the row-level user_access tier never ran for a token-authenticated caller. Issue an API key instead (app.auth.apiKeys) and present it on the x-api-key header, then unset ${stillSet.join(', ')}.`
  }

  if (env?.MCP_AUTH_STRATEGY === 'token') {
    return 'MCP_AUTH_STRATEGY=token names a strategy that no longer exists. /mcp now dispatches on the header a request carries: x-api-key is verified as an API key, Authorization: Bearer as an OAuth access token. Unset MCP_AUTH_STRATEGY (oauth2 is still accepted as a deprecated no-op).'
  }

  if (context?.authConfigured === false) {
    return 'MCP_ENABLED=true requires app.auth to be configured. Both MCP credentials — API keys and OAuth access tokens — are Better Auth plugins, so without app.auth nobody can authenticate to /mcp. Either configure app.auth or unset MCP_ENABLED.'
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Parse from process.env
// ---------------------------------------------------------------------------

export const parseMcpEnvConfig = (env: NodeJS.ProcessEnv = process.env): McpEnvConfig =>
  Schema.decodeUnknownSync(McpEnvSchema)({
    enabled: env.MCP_ENABLED,
    transport: env.MCP_TRANSPORT,
    mountPath: env.MCP_MOUNT_PATH,
    rateLimitPerMinute: env.MCP_RATE_LIMIT_PER_MINUTE,
    rateLimitPerDay: env.MCP_RATE_LIMIT_PER_DAY,
    auditEnabled: env.MCP_AUDIT_ENABLED,
    exposeInternals: env.MCP_EXPOSE_INTERNALS,
    confirmDestructive: env.MCP_CONFIRM_DESTRUCTIVE,
  })
