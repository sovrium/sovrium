/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The MCP mount's environment: decode the `MCP_*` variables, validate them
 * against the app before anything is mounted, and announce a write flag the
 * HTTP mount ignores. Read once, at mount time, by `setupMcpRoutes`
 * (`routes.ts`), so a misconfigured deployment fails on boot rather than on
 * its first request.
 */

import { Schema } from 'effect'
import {
  MCP_CONFIG_WRITE_IGNORED_NOTICE,
  McpEnvSchema,
  parseMcpConfigWrite,
  resolveMcpEnv,
  validateMcpEnv,
  type McpEnvConfig,
  type ResolvedMcpEnvConfig,
} from '@/domain/models/process-env/mcp'
import { logWarning } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

/**
 * Say, once per boot, that `MCP_CONFIG_WRITE` bought this instance nothing.
 *
 * `logWarning` rather than a thrown refusal: refusing the boot was considered
 * and rejected, because an HTTP instance booted with this exact variable set is
 * specified to serve. Refusing it to enforce [internal ref] A8 would read the
 * amendment against itself — its regression fence names the existing behaviour
 * as the thing that must keep working.
 */
export const announceIgnoredConfigWrite = (env: NodeJS.ProcessEnv): void => {
  if (!parseMcpConfigWrite(env)) return

  logWarning(MCP_CONFIG_WRITE_IGNORED_NOTICE)
}

export const parseAndValidateMcpEnv = (
  app: Readonly<App>,
  env: Readonly<NodeJS.ProcessEnv>
): ResolvedMcpEnvConfig => {
  // Decode env vars via the schema. Throws on invalid values (e.g. a
  // non-positive rate limit).
  const resolved = resolveMcpEnv(decodeMcpEnv(env))
  if (!resolved.enabled) return resolved

  // The raw env goes through so the retired-var guard can see names the schema
  // no longer carries — that is the whole point of detecting them by presence
  // rather than by a constraint on a field that no longer exists.
  const validationError = validateMcpEnv(resolved, {
    authConfigured: app.auth !== undefined,
    env,
  })
  if (validationError !== undefined) {
    throw new Error(`MCP env validation failed: ${validationError}`)
  }
  return resolved
}

const decodeMcpEnv = (env: Readonly<NodeJS.ProcessEnv>): McpEnvConfig => {
  try {
    return Schema.decodeUnknownSync(McpEnvSchema)({
      enabled: env.MCP_ENABLED,
      transport: env.MCP_TRANSPORT,
      mountPath: env.MCP_MOUNT_PATH,
      rateLimitPerMinute: env.MCP_RATE_LIMIT_PER_MINUTE,
      rateLimitPerDay: env.MCP_RATE_LIMIT_PER_DAY,
      auditEnabled: env.MCP_AUDIT_ENABLED,
      exposeInternals: env.MCP_EXPOSE_INTERNALS,
      confirmDestructive: env.MCP_CONFIRM_DESTRUCTIVE,
    })
  } catch (error) {
    // Re-throw with a stable prefix so operators (and the test regex) see
    // the MCP-specific tag at the top of the stderr blob, ahead of the
    // verbose schema diff that Effect renders for parse errors.
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`MCP env validation failed: ${message}`, { cause: error })
  }
}
