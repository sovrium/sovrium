/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * MCP environment configuration.
 *
 * Mounts the MCP server route, picks transport, configures auth strategy and
 * tokens, sets rate limits, and toggles audit + admin internals exposure.
 *
 * Following the env-var pattern established by DATABASE_URL, STORAGE_PROVIDER,
 * AUTH_SECRET, and AI_PROVIDER (DEC-009): infrastructure concerns are operator
 * config (env vars), schema-author concerns are app/business intent (declared
 * in `app.tables[].aiAccess`, `app.automations[].aiAccess`, etc.).
 *
 * Default: MCP_ENABLED=false. Operator must explicitly opt in.
 *
 * Env vars:
 *   MCP_ENABLED, MCP_TRANSPORT, MCP_MOUNT_PATH, MCP_AUTH_STRATEGY,
 *   MCP_TOKEN_ADMIN, MCP_TOKEN_MEMBER, MCP_TOKEN_VIEWER,
 *   MCP_RATE_LIMIT_PER_MINUTE, MCP_RATE_LIMIT_PER_DAY,
 *   MCP_AUDIT_ENABLED, MCP_EXPOSE_INTERNALS, MCP_CONFIRM_DESTRUCTIVE
 */

// ---------------------------------------------------------------------------
// Helper: BooleanFromString — env vars are always strings
// ---------------------------------------------------------------------------

const BooleanFromString = Schema.transform(
  Schema.Literal('true', 'false', 'TRUE', 'FALSE', '1', '0'),
  Schema.Boolean,
  {
    strict: true,
    decode: (s) => s === 'true' || s === 'TRUE' || s === '1',
    encode: (b) => (b ? ('true' as const) : ('false' as const)),
  }
)

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const McpTransportSchema = Schema.Literal('stdio', 'streamable-http')
export type McpTransport = typeof McpTransportSchema.Type

export const McpAuthStrategySchema = Schema.Literal('token', 'oauth2')
export type McpAuthStrategy = typeof McpAuthStrategySchema.Type

export const McpEnvSchema = Schema.Struct({
  enabled: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotations({
        description:
          'Master switch — server only mounts the /mcp route when true (MCP_ENABLED). Default: false.',
      })
    )
  ),
  transport: Schema.optional(
    McpTransportSchema.pipe(
      Schema.annotations({
        description:
          'Transport choice (MCP_TRANSPORT). streamable-http for remote clients (Claude Desktop, ChatGPT Dev Mode), stdio for local IDE integration. Default: streamable-http.',
      })
    )
  ),
  mountPath: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^\/[a-z0-9\-/]*$/),
      Schema.annotations({
        description:
          'Hono route prefix when transport=streamable-http (MCP_MOUNT_PATH). Default: /mcp.',
      })
    )
  ),
  authStrategy: Schema.optional(
    McpAuthStrategySchema.pipe(
      Schema.annotations({
        description:
          'Authentication strategy (MCP_AUTH_STRATEGY). oauth2 when app.auth is configured (default), token otherwise. Token mode reads MCP_TOKEN_* env vars; oauth2 mode requires Better Auth OAuth-server plugin.',
      })
    )
  ),
  tokenAdmin: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(32),
      Schema.annotations({
        description:
          'Bearer token granting admin role (MCP_TOKEN_ADMIN). Must be ≥32 chars. Generate via `openssl rand -hex 32`.',
      })
    )
  ),
  tokenMember: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(32),
      Schema.annotations({
        description: 'Bearer token granting member role (MCP_TOKEN_MEMBER). Must be ≥32 chars.',
      })
    )
  ),
  tokenViewer: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(32),
      Schema.annotations({
        description: 'Bearer token granting viewer role (MCP_TOKEN_VIEWER). Must be ≥32 chars.',
      })
    )
  ),
  rateLimitPerMinute: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Per-token requests per minute (MCP_RATE_LIMIT_PER_MINUTE). Default: 60.',
      })
    )
  ),
  rateLimitPerDay: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Per-token requests per day (MCP_RATE_LIMIT_PER_DAY). Default: 5000.',
      })
    )
  ),
  auditEnabled: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotations({
        description:
          'Log every tool call to system.ai_tool_calls + activity stream (MCP_AUDIT_ENABLED). Default: true. Disabling is permitted for compliance edge cases but strongly discouraged.',
      })
    )
  ),
  exposeInternals: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotations({
        description:
          'Expose auth + system pgSchema tables read-only to admin role (MCP_EXPOSE_INTERNALS). Default: true. Toggle to false to remove all internal tools from tools/list, including for admins.',
      })
    )
  ),
  confirmDestructive: Schema.optional(
    BooleanFromString.pipe(
      Schema.annotations({
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
  readonly authStrategy: McpAuthStrategy | undefined
  readonly tokenAdmin: string | undefined
  readonly tokenMember: string | undefined
  readonly tokenViewer: string | undefined
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
  authStrategy: parsed.authStrategy,
  tokenAdmin: parsed.tokenAdmin,
  tokenMember: parsed.tokenMember,
  tokenViewer: parsed.tokenViewer,
  rateLimitPerMinute: parsed.rateLimitPerMinute ?? MCP_ENV_DEFAULTS.rateLimitPerMinute,
  rateLimitPerDay: parsed.rateLimitPerDay ?? MCP_ENV_DEFAULTS.rateLimitPerDay,
  auditEnabled: parsed.auditEnabled ?? MCP_ENV_DEFAULTS.auditEnabled,
  exposeInternals: parsed.exposeInternals ?? MCP_ENV_DEFAULTS.exposeInternals,
  confirmDestructive: parsed.confirmDestructive ?? MCP_ENV_DEFAULTS.confirmDestructive,
})

// ---------------------------------------------------------------------------
// Validation — startup checks beyond decode (cross-field rules)
// ---------------------------------------------------------------------------

/**
 * Cross-rule validation that cannot be expressed inside the decode schema:
 * - token strategy requires at least one MCP_TOKEN_* set
 * - oauth2 strategy requires app.auth wired (caller checks; we only enforce
 *   that an authStrategy override of 'oauth2' is consistent with token vars
 *   being potentially absent)
 *
 * Run at server startup *after* decode succeeds. Returns `undefined` when
 * the config is valid, or a human-readable error message string when a
 * required combination is missing. The caller decides how to surface the
 * error (throwing at startup is the typical choice).
 *
 * The optional `context` argument allows the caller (route setup) to surface
 * the app-level constraint that `oauth2` strategy can only run when Better
 * Auth is wired (`app.auth` configured). When `authConfigured: false` and
 * the strategy resolves to `oauth2`, validation fails with a startup error
 * that mentions both `oauth2` and `app.auth` so operators / TDD specs can
 * pattern-match on either token (APP-AI-MCP-AUTH-OAUTH-008).
 */
export const validateMcpEnv = (
  config: ResolvedMcpEnvConfig,
  context?: { readonly authConfigured?: boolean }
): string | undefined => {
  if (!config.enabled) return undefined

  const hasAnyToken = Boolean(config.tokenAdmin || config.tokenMember || config.tokenViewer)

  if (config.authStrategy === 'token' && !hasAnyToken) {
    return 'MCP_AUTH_STRATEGY=token but no MCP_TOKEN_ADMIN/MEMBER/VIEWER is set. At least one role token must be configured for clients to authenticate.'
  }

  if (config.authStrategy === 'oauth2' && context?.authConfigured === false) {
    return 'MCP_AUTH_STRATEGY=oauth2 requires app.auth to be configured (Better Auth OAuth-server plugin must be mounted). Either configure app.auth or switch to MCP_AUTH_STRATEGY=token with MCP_TOKEN_* env vars.'
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
    authStrategy: env.MCP_AUTH_STRATEGY,
    tokenAdmin: env.MCP_TOKEN_ADMIN,
    tokenMember: env.MCP_TOKEN_MEMBER,
    tokenViewer: env.MCP_TOKEN_VIEWER,
    rateLimitPerMinute: env.MCP_RATE_LIMIT_PER_MINUTE,
    rateLimitPerDay: env.MCP_RATE_LIMIT_PER_DAY,
    auditEnabled: env.MCP_AUDIT_ENABLED,
    exposeInternals: env.MCP_EXPOSE_INTERNALS,
    confirmDestructive: env.MCP_CONFIRM_DESTRUCTIVE,
  })
