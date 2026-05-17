/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

/**
 * Detect whether ALL of an automation's connection-bound actions reference a
 * `scope: 'user'` connection. When true, the manual trigger's default
 * `requiredRole` is relaxed from `'admin'` to `'member'` — per-user-token
 * automations are intended to be invoked by individual users using their
 * own tokens, so an admin-only gate would defeat the per-user model.
 * Triggers that declare `requiredRole` explicitly retain that value (this
 * only changes the implicit default).
 *
 * MIXED-SCOPE SAFETY (REC-C4-2): If ANY connection-bound action references
 * a `scope: 'app'` connection (or a non-oauth2 connection, which is
 * implicitly app-scoped), the predicate returns false so the implicit
 * default stays at `'admin'`. Otherwise a non-admin caller could invoke a
 * flow that touches an admin-managed app-scoped resource by piggy-backing
 * on a user-scoped sibling action.
 *
 * Actions without a `connection` prop (state, record, log, etc.) are
 * ignored — they neither relax nor tighten the gate.
 *
 * Specs APP-AUTOMATION-CONNECTION-073 / -076 / -077 trigger automations
 * with `scope: 'user'` connections as a regular `createAuthenticatedUser`
 * (member) and assert the run executes (or fails on the action's
 * no-token branch) rather than 403'ing at the trigger gate.
 */
/**
 * Map a connection's raw shape to its effective scope.
 *
 *  - apiKey/basic/bearer → always 'app' (no per-user variant exists in
 *    the schema for these types)
 *  - oauth2 with `props.scope === 'user'` → 'user'
 *  - oauth2 default (props.scope undefined or 'app') → 'app'
 */
const connectionScope = (conn: Readonly<Record<string, unknown>>): 'user' | 'app' => {
  if (conn['type'] !== 'oauth2') return 'app'
  const props = conn['props'] as Record<string, unknown> | undefined
  return props !== undefined && props['scope'] === 'user' ? 'user' : 'app'
}

/**
 * Extract the connection name an action references, if any. Returns
 * `undefined` for non-connection-bound actions (state, log, etc.) — these
 * don't constrain the role gate either way.
 */
const referencedConnectionName = (
  action: Readonly<Record<string, unknown>>
): string | undefined => {
  const { props } = action as { props?: Record<string, unknown> }
  if (props === undefined) return undefined
  const connName = props['connection']
  return typeof connName === 'string' && connName !== '' ? connName : undefined
}

/** @internal — exported for unit tests; prefer the `runManualAutomation` entry point. */
export const usesUserScopedConnection = (
  automation: NonNullable<App['automations']>[number],
  app: App
): boolean => {
  const { connections } = app as { connections?: readonly Record<string, unknown>[] }
  if (connections === undefined || connections.length === 0) return false

  // Index connections by name. apiKey/basic/bearer are always app-scoped
  // (no per-user variant exists in the schema); oauth2 defaults to 'app'
  // unless props.scope === 'user'.
  const scopeByName = new Map<string, 'user' | 'app'>(
    connections
      .filter((conn) => String(conn['name'] ?? '') !== '')
      .map((conn) => [String(conn['name']), connectionScope(conn)] as const)
  )

  // Filter the action list to just the connection-bound actions, then
  // classify each. An unknown connection name (typo, deleted from
  // app.connections) is treated as 'app' — fail-closed so a stale
  // reference cannot silently relax the gate. Cast each action to the
  // record-shape `referencedConnectionName` reads — Effect Schema's
  // discriminated-union `Action` type doesn't satisfy the open
  // `Record<string, unknown>` index, but structurally each member has
  // a `props` field we can read.
  const connectionRefs = (
    automation.actions as readonly unknown[] as readonly Readonly<Record<string, unknown>>[]
  )
    .map(referencedConnectionName)
    .filter((name): name is string => name !== undefined)
    .map((name) => scopeByName.get(name) ?? 'app')

  // Mixed scope: any 'app' reference forces the gate to stay at 'admin'.
  if (connectionRefs.some((scope) => scope === 'app')) return false
  return connectionRefs.some((scope) => scope === 'user')
}

/**
 * Locate a manual-triggered automation by name and reject states that
 * should not produce a run (missing, disabled, or non-manual trigger).
 *
 * Disabled and non-existent automations both 404 to prevent enumeration,
 * matching the convention `resolveWebhookAutomation` already established.
 */
const resolveManualAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false)
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'manual') {
    return Effect.fail({ _tag: 'AutomationNotManualTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Options bag for {@link runManualAutomation}. Mirrors the webhook entry
 * point but adds `userRole` for permission gating against the trigger's
 * `requiredRole` (default `'admin'`).
 */
export interface RunManualAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Caller's role from the auth.users table — used to enforce the manual
   * trigger's `requiredRole` constraint. The route must call
   * `getUserRole(session.userId)` BEFORE invoking this program; passing
   * undefined means the caller is anonymous and the request will be
   * rejected unless the trigger explicitly allows that role.
   */
  readonly userRole: string | undefined
  /** Optional input payload from the manual-trigger request body. */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

/**
 * Execute a manual-triggered automation by name. Distinct from the webhook
 * entry point because:
 *
 *  1. Trigger type must be `'manual'` — webhook-only automations cannot be
 *     invoked through this route (and vice versa).
 *  2. Caller must satisfy the trigger's `requiredRole` (default: `'admin'`).
 *
 * Same persistence + run-history contract as the webhook variant — both
 * funnel through `executeAutomationRun`.
 */
export const runManualAutomation = ({
  name,
  app,
  processEnv,
  userRole,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
}: RunManualAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveManualAutomation(app, name)

    // ManualTrigger schema guarantees `trigger.type === 'manual'`; the
    // optional `requiredRole` defaults to 'admin' when omitted (per
    // APP-AUTOMATION-TRIGGER-MANUAL-003) — UNLESS any of the automation's
    // actions reference a `scope: 'user'` connection, in which case the
    // implicit default is relaxed to 'member'. Per-user-token automations
    // (APP-AUTOMATION-CONNECTION-073 / -076 / -077) are designed to be
    // invoked by individual users using their own stored tokens, so an
    // admin-only gate would contradict the per-user model. An explicit
    // `requiredRole` always wins over this heuristic.
    //
    // Role hierarchy: an `admin` caller satisfies any `requiredRole` —
    // admin subsumes member, viewer, and any custom role. Without this
    // an admin invoking a `requiredRole: 'member'` automation (e.g. the
    // per-user-tokens regression flow that re-authenticates as admin
    // after step 074) would 403 even though the admin clearly outranks
    // the requirement.
    const explicitRole =
      automation.trigger.type === 'manual' ? automation.trigger.requiredRole : undefined
    const defaultRole = usesUserScopedConnection(automation, app) ? 'member' : 'admin'
    const requiredRole = explicitRole ?? defaultRole
    const callerSatisfiesRole = userRole === requiredRole || userRole === 'admin'
    if (!callerSatisfiesRole) {
      return yield* Effect.fail({
        _tag: 'AutomationManualRoleRequired' as const,
        name,
        required: requiredRole,
      } satisfies RunAutomationError)
    }

    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId,
    })
  })
