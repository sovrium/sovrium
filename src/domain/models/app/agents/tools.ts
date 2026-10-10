/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Supported agent action types.
 *
 * These define what operations an agent can perform autonomously.
 * Each entry follows the `type.operator` pattern from the automation action schema.
 *
 * Categories:
 * - **Record**: CRUD on allowed tables. `record.read` and `record.list` are two
 *   distinct capabilities, not one granted twice: `read` fetches a single row by
 *   primary key, `list` returns a filtered / ordered / bounded set. Granting
 *   `read` alone therefore deliberately withholds the ability to sweep a table,
 *   which is why `list` is its own grant rather than a mode of `read`.
 * - **State**: Cross-run key-value persistence
 * - **HTTP**: External API calls
 * - **AI**: Chain LLM sub-tasks (generate, classify, extract)
 * - **Code**: Execute sandboxed TypeScript
 * - **Email**: Send emails via configured SMTP
 * - **Auth**: User management operations
 * - **File**: File storage operations
 * - **Browser**: Drive a browser towards a goal (`browser.use`), within the
 *   hosts and sessions of the agent's `tools.browser`
 */
export const AgentActionSchema = Schema.Literals(
  // Record operations
  [
    'record.read',
    'record.list',
    'record.create',
    'record.update',
    'record.delete',
    'state.get',
    'state.set',
    'state.increment',
    'state.delete',
    'state.list',
    'http.request',
    'ai.generate',
    'ai.classify',
    'ai.extract',
    'code.runTypescript',
    'email.send',
    'auth.createUser',
    'auth.assignRole',
    'auth.banUser',
    'auth.unbanUser',
    'file.upload',
    'file.download',
    'file.delete',
    'file.list',
    'file.getMetadata',
    'browser.use',
  ]
).pipe(
  Schema.annotate({
    description: 'Action type the agent can perform (type.operator format)',
  })
)

/** @public */
export type AgentAction = Schema.Schema.Type<typeof AgentActionSchema>

/**
 * A host an agent's browser may reach. The same grammar as a browser action's
 * `allowedHosts` (`automations/actions/browser/run.ts`), repeated because one
 * property never imports another.
 */
const AGENT_BROWSER_HOST_PATTERN =
  /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i

/**
 * What an agent granted `browser.use` may reach: the second gate of that tool.
 *
 * The first gate is `browser.use` itself in `tools.actions`; this one is held
 * by the browser driver, never by the model. A host or a session the agent's
 * tool call names outside these lists is refused before the browser opens,
 * and every request a page makes is checked against `allowedHosts`.
 */
export const AgentBrowserCapabilitiesSchema = Schema.Struct({
  allowedHosts: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'A host name, optionally with a port: "app.example.com", "*.example.com" (any sub-domain, not the domain itself), "login.example.com:8443". Written out, never a template.',
      }),
      Schema.check(Schema.isPattern(AGENT_BROWSER_HOST_PATTERN))
    )
  ).pipe(
    Schema.annotate({
      description:
        'Every host the browser may reach for this agent. A start address on another host is refused, and a request any page makes to another host is blocked, whatever a page tells the agent.',
      examples: [['portal.example.com', 'login.example.com']],
    }),
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(50))
  ),
  sessions: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'Name of a stored browser session the agent may use' }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/))
      )
    ).pipe(
      Schema.annotate({
        defaultNote: 'none: every browser the agent opens starts signed out',
        description:
          'Stored browser sessions the agent may start from — the sign-ins a `browser/run` keeps. The agent never receives a password: a session is how it reaches pages behind a sign-in. Any other session name is refused.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentBrowserCapabilities',
    title: 'Agent Browser Capabilities',
    description:
      'The hosts and stored sessions an agent granted `browser.use` may reach. Required with `browser.use`, refused without it.',
  })
)

/** @public */
export type AgentBrowserCapabilities = Schema.Schema.Type<typeof AgentBrowserCapabilitiesSchema>

/** `browser.use` and `tools.browser` come together, or not at all. */
const browserGrantIsWhole = (capabilities: {
  readonly actions: ReadonlyArray<string>
  readonly browser?: unknown
}): boolean => capabilities.actions.includes('browser.use') === (capabilities.browser !== undefined)

/**
 * AgentCapabilitiesSchema defines the tool allowlist for an agent.
 *
 * This implements a double-gate security model:
 * 1. RBAC gate: Does the agent's role have permission for this table/action?
 * 2. Allowlist gate: Is this table/action in the agent's capabilities?
 *
 * Both gates must pass. An agent without capabilities has NO access (secure by default).
 */
export const AgentCapabilitiesSchema = Schema.Struct({
  /** Table names the agent can access (must reference tables defined in the schema) */
  tables: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({ description: 'Table name the agent can access' }),
      Schema.check(Schema.isMinLength(1))
    )
  ).pipe(
    Schema.annotate({
      description: 'Table names the agent can access (must reference tables defined in the schema)',
      examples: [['tickets', 'customers']],
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Action types the agent can perform */
  actions: Schema.Array(AgentActionSchema).pipe(
    Schema.annotate({
      description: 'Action types the agent can perform',
      examples: [['record.read', 'record.update']],
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Hosts and sessions for `browser.use` (required with it, refused without it) */
  browser: Schema.optional(AgentBrowserCapabilitiesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'AgentCapabilities',
    title: 'Agent Capabilities',
    description:
      'Tool allowlist defining which tables and actions an agent can access. Implements double-gate security (RBAC + allowlist).',
  }),
  Schema.check(
    Schema.makeFilter(browserGrantIsWhole, {
      message:
        '`browser.use` in `actions` requires `browser: { allowedHosts }`, and `browser` is refused without `browser.use`',
    })
  )
)

/** @public */
export type AgentCapabilities = Schema.Schema.Type<typeof AgentCapabilitiesSchema>
