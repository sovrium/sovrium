/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The HTTP half of [internal ref] amendment A8 surface 9: the four `{app}_config_*`
 * read tools, mounted alongside the user-defined and internals tools.
 *
 * The tool DEFINITIONS and the `tools/call` dispatch are shared with the stdio
 * verb and live in `@/application/use-cases/config/config-mcp-tools` — the one
 * layer both a Hono route and `src/cli/**` may import. What is here is the
 * HTTP-specific half: the admin gate, the provider bound to the BOOTED
 * instance, and the conversion of a refusal into a thrown `ProtocolError`.
 *
 * ─── WHY THE PROVIDER REFLECTS THE BOOT AND NOT THE DISK ────────────────────
 *
 * The two user stories split this deliberately, and the split is not an
 * implementation shortcut. Over stdio, the caller is an AI that has just
 * rewritten a partial and needs the verdict on WHAT IT WROTE, so that verb
 * re-reads the disk. Over HTTP, the caller is asking what THIS RUNNING
 * INSTANCE is configured to do — and an instance that is answering the request
 * has by construction decoded its config, which is why `_config_validate`
 * reports it valid here. A route could not read the disk in any case:
 * `presentation-api` may reach neither `infrastructure-config` nor
 * `infrastructure-server`, so the one
 * file-backed read it needs — the status document — arrives injected from
 * `compose-hono-app.ts`, the composition root that owns both sides.
 *
 * Redaction is a CONDITION of the authorisation rather than a hardening step:
 * A8 restates A1's *"a config-reflection endpoint that leaks a secret is not a
 * defective implementation of an authorised surface — it is an unauthorised
 * surface."* So `_config_read` serialises through the SAME
 * `redactAppConfigForReflection` that backs `GET /api/admin/config/schema`,
 * and does not grow its own.
 *
 */

import { redactAppConfigForReflection } from '@/application/use-cases/admin/config/redact-app-config'
import {
  asStatusDocument,
  handleConfigToolCall,
  type ConfigReadPayload,
  type ConfigToolsProvider,
  type ConfigValidatePayload,
} from '@/application/use-cases/config/config-mcp-tools'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { App } from '@/domain/models/app'
import type { McpCaller } from '@/presentation/api/mcp/auth'

/**
 * Read the status document a running instance publishes.
 *
 * A FUNCTION rather than a module import: `status-file.ts` is
 * `infrastructure-server`, which the comment on the `presentation-api` rule in
 * `[internal ref]` closes to routes in as many words. The
 * composition root supplies it.
 *
 * It returns `unknown` deliberately. The document is a FILE this process did
 * not necessarily write — a stale one from an older version, or a half-written
 * one — so the route narrows it rather than trusting a declared shape, and the
 * port needs no cast at the seam that supplies it.
 */
export type ReadStatusDocument = () => Promise<unknown>

/** What the HTTP mount hands the config tools. */
export interface HttpConfigToolsDeps {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly configHash: string
  readonly readStatusDocument: ReadStatusDocument
}

/**
 * The status document this instance published, narrowed by the shared reader.
 *
 * The `not-running` shape and the narrowing both come from `asStatusDocument`,
 * so the HTTP mount and the stdio verb cannot describe an absent instance
 * differently.
 */
const readStatusOrNotRunning = async (
  read: ReadStatusDocument
): Promise<Readonly<Record<string, unknown>>> => asStatusDocument(await read())

/**
 * The config path the running instance booted from, or `''` for an inline
 * config (`APP_SCHEMA=…`), which has no file and therefore no `$ref` graph.
 */
const bootedConfigPath = (status: Readonly<Record<string, unknown>>): string => {
  const { configPath } = status
  return typeof configPath === 'string' ? configPath : ''
}

const buildReadPayload = async (deps: HttpConfigToolsDeps): Promise<ConfigReadPayload> => {
  const status = await readStatusOrNotRunning(deps.readStatusDocument)
  const configPath = bootedConfigPath(status)
  return {
    config: redactAppConfigForReflection(deps.app, deps.processEnv),
    // The ROOT file only. Enumerating the `$ref` graph means re-reading it,
    // which is `infrastructure-config` and therefore the stdio verb's job; the
    // caller that needs the whole graph is the one editing files, and it has
    // `sovrium mcp`.
    files: configPath === '' ? [] : [configPath],
    configHash: deps.configHash,
  }
}

/**
 * The verdict on the config this instance is RUNNING.
 *
 * `valid: true` is not a stub: this code path executes inside a server that
 * decoded its configuration and bound a port. Findings can only come from a
 * config that failed to decode, and such a config never reaches a request
 * handler — `sovrium start` exits before the socket binds. A caller that wants
 * the verdict on what is on DISK right now is asking a different question, and
 * `sovrium mcp` answers it.
 */
const bootedVerdict = (): ConfigValidatePayload => ({ valid: true, findings: [], notices: [] })

/** Bind the four reads to the booted instance. */
export const buildHttpConfigToolsProvider = (deps: HttpConfigToolsDeps): ConfigToolsProvider => ({
  appName: deps.app.name,
  readConfig: async () => buildReadPayload(deps),
  validateConfig: async () => bootedVerdict(),
  readStatus: async () => readStatusOrNotRunning(deps.readStatusDocument),
})

/**
 * Answer a config `tools/call` on HTTP.
 *
 * Admin-only, matching the D4 guard every A1/A2/A6 surface sits behind. Hiding
 * the tools from `tools/list` is NOT the enforcement — a client that read
 * another instance's catalogue can call one by name — so the gate is here, at
 * the call, and it refuses before any read runs.
 */
export const handleHttpConfigToolCall = async (input: {
  readonly caller: McpCaller
  readonly toolName: string
  readonly args: Readonly<Record<string, unknown>>
  readonly deps: HttpConfigToolsDeps
}): Promise<McpToolResult> => {
  if (!isAdminRole(input.caller.role)) {
    return toolFailure(
      -32_603,
      `Access denied: ${input.toolName} is admin-only. The configuration surface is observability for the operator, not a tool every role reads.`
    )
  }
  const outcome = await handleConfigToolCall(
    buildHttpConfigToolsProvider(input.deps),
    input.toolName,
    input.args
  )
  if (outcome.kind === 'refused') return toolFailure(outcome.code, outcome.message)
  return toolSuccess(outcome.payload)
}
