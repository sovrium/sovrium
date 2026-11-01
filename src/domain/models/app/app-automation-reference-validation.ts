/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flattenActions } from './automations/step-read-service'
import { findAppTodoPlaceholders } from './automations/todo-placeholder-validation'
import { entriesOfType } from './automations/trigger-entries-service'
import { credentialBindingIssue } from './connections/connection-credential-binding-validation'
import { connectionCallIssue } from './connections/connection-file-source-validation'
import type { ActionTemplates } from './actions'
import type { Agents } from './agents'
import type { Action, Automations } from './automations'
import type { Forms } from './forms'
import type { Tables } from './tables'

/**
 * Every name an automation uses must name something the app declares: the table
 * a record or comment trigger watches and a record action writes, the action
 * template a `$ref` step calls, the connection a step uses, the agent an
 * `ai:agent` step runs, the form a form trigger listens to, and the automations
 * an automation-failure trigger watches. Each function is the body of one
 * `AppSchema` filter, with the same messages, kept beside `app.ts` so the schema
 * reads as a list.
 *
 * A config with no `tables` key declares an EMPTY set, not an unknown one, so
 * every table-naming surface is refused there too. `automation:call` targets are
 * NOT checked here: a missing callee surfaces as a failed run, so a caller can
 * ship before its callee lands.
 */

/**
 * Record and comment triggers, and record actions, name a table the app declares —
 * every entry of every automation, not only the first.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAutomationTableReferences = (app: {
  readonly automations?: Automations | undefined
  readonly tables?: Tables | undefined
}): true | string => {
  if (!app.automations) return true

  const tableNames = new Set((app.tables ?? []).map((t) => t.name))

  // Every record and comment entry of every automation, not only the first.
  const triggerError = [
    ...entriesOfType(app.automations, 'record'),
    ...entriesOfType(app.automations, 'comment'),
  ].find(({ trigger }) => !tableNames.has(trigger.table))
  if (triggerError) {
    const { automation, trigger } = triggerError
    return `Automation '${automation}' ${trigger.type} trigger references table '${trigger.table}' which does not exist`
  }

  const actionError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter(
          (
            action
          ): action is Action & {
            readonly type: 'record'
            readonly props: { readonly table: string }
          } => action.type === 'record' && !tableNames.has(action.props.table)
        )
        .map((action) => ({ automation: a.name, action }))
    )
    .at(0)
  if (actionError) {
    return `Automation '${actionError.automation}' record action '${actionError.action.name}' references table '${actionError.action.props.table}' which does not exist`
  }

  return true
}

/**
 * A `$ref` step names an `app.actions[]` template; a live automation's trigger,
 * or a template it calls, may not hold a `{{todo.*}}` placeholder.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateActionTemplateReferences = (app: {
  readonly automations?: Automations | undefined
  readonly actions?: ActionTemplates | undefined
}): true | string | ReturnType<typeof findAppTodoPlaceholders> => {
  if (!app.automations) return true
  const templateNames = new Set(app.actions?.map((t) => t.name) ?? [])

  const refError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter(
          (action): action is Action & { readonly type: 'ref'; readonly $ref: string } =>
            action.type === 'ref'
        )
        .filter((action) => !templateNames.has(action.$ref))
        .map((action) => ({ automation: a.name, action }))
    )
    .at(0)

  if (refError) {
    const available =
      templateNames.size > 0
        ? `. Available templates: ${Array.from(templateNames).toSorted().join(', ')}`
        : '. No action templates are defined in app.actions[]'
    return `Automation '${refError.automation}' action '${refError.action.name}' references template '${refError.action.$ref}' which does not exist${available}`
  }
  // A live automation's trigger, or a template it calls, may not hold a `{{todo.*}}`.
  return findAppTodoPlaceholders(app)
}

/**
 * Any step carrying a `connection` names a declared connection, whatever its type;
 * an http or webhook step sends its connection's credential only to the site the
 * connection is bound to; and a `connection/call` step fits the operation it names, with no file parameter
 * reading what the trigger's caller chooses (`connections/connection-file-source-validation.ts`).
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateActionConnectionReferences = (
  app: Parameters<typeof connectionCallIssue>[2] & {
    readonly automations?: Automations | undefined
  }
): true | string => {
  if (!app.automations) return true

  const connectionNames = new Set(app.connections?.map((c) => c.name) ?? [])

  const connectionError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter(
          (action): action is Action & { readonly props: { readonly connection?: string } } =>
            'props' in action &&
            action.props !== undefined &&
            typeof action.props === 'object' &&
            'connection' in (action.props as Record<string, unknown>) &&
            (action.props as Record<string, unknown>).connection !== undefined &&
            !connectionNames.has((action.props as Record<string, unknown>).connection as string)
        )
        .map((action) => ({ automation: a.name, action }))
    )
    .at(0)

  if (connectionError) {
    return `Automation '${connectionError.automation}' action '${connectionError.action.name}' references connection '${(connectionError.action.props as { readonly connection: string }).connection}' which does not exist`
  }

  // An http or webhook step sends its connection's credential only to the
  // site the connection is bound to (`connection-credential-binding-validation.ts`).
  const bindingError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions).map((action) => ({
        automation: a.name,
        action,
        issue: credentialBindingIssue(action, app.connections),
      }))
    )
    .find((entry) => entry.issue !== undefined)
  if (bindingError) {
    return `Automation '${bindingError.automation}' action '${bindingError.action.name}' ${bindingError.issue ?? ''}`
  }

  // A `connection` / `call` step must fit the operation it names, and a file
  // parameter may not read what the trigger's caller chooses. Folded into
  // this check: the AppSchema pipe is at its arity limit.
  const callError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter(
          (action): action is Extract<Action, { readonly type: 'connection' }> =>
            action.type === 'connection' && action.operator === 'call'
        )
        .map((action) => ({
          automation: a.name,
          action,
          issue: connectionCallIssue(a, action.props, app),
        }))
    )
    .find((entry) => entry.issue !== undefined)

  return callError === undefined
    ? true
    : `Automation '${callError.automation}' action '${callError.action.name}' ${callError.issue ?? ''}`
}

/**
 * An `ai:agent` step names a declared agent, and needs `app.agents` at all.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAgentActionReferences = (app: {
  readonly automations?: Automations | undefined
  readonly agents?: Agents | undefined
}): true | string => {
  if (!app.automations) return true

  const agentNames = new Set(app.agents?.map((a) => a.name) ?? [])

  const agentError = app.automations
    .flatMap((a) =>
      flattenActions(a.actions)
        .filter(
          (
            action
          ): action is Action & {
            readonly type: 'ai'
            readonly operator: 'agent'
            readonly props: { readonly agent: string }
          } => action.type === 'ai' && action.operator === 'agent'
        )
        .filter((action) => !agentNames.has(action.props.agent))
        .map((action) => ({ automation: a.name, action }))
    )
    .at(0)

  if (agentError) {
    if (!app.agents) {
      return `Automation '${agentError.automation}' uses ai:agent action but app.agents is not configured`
    }
    const available = Array.from(agentNames).toSorted().join(', ')
    return `Automation '${agentError.automation}' action '${agentError.action.name}' references agent '${agentError.action.props.agent}' which does not exist. Available agents: ${available}`
  }

  return true
}

/**
 * A form trigger names a form declared in `app.forms[]`.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateFormTriggerReferences = (app: {
  readonly automations?: Automations | undefined
  readonly forms?: Forms | undefined
}): true | string => {
  if (!app.automations) return true

  const formNames = new Set((app.forms ?? []).map((f) => f.name))
  const missing = entriesOfType(app.automations, 'form').find(
    ({ trigger }) => !formNames.has(trigger.form)
  )
  if (missing) {
    return `Automation '${missing.automation}' form trigger references form '${missing.trigger.form}' which does not exist in app.forms[]`
  }
  return true
}

/**
 * An automation-failure trigger watches automations that exist.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAutomationFailureReferences = (app: {
  readonly automations?: Automations | undefined
}): true | string => {
  if (!app.automations) return true

  const automationNames = new Set(app.automations.map((a) => a.name))

  const missingError = entriesOfType(app.automations, 'automation-failure')
    .flatMap(({ automation, trigger }) =>
      (trigger.automations ?? [])
        .filter((name) => !automationNames.has(name))
        .map((missing) => ({ automation, missing }))
    )
    .at(0)

  if (missingError) {
    return `Automation '${missingError.automation}' automation-failure trigger references automation '${missingError.missing}' which does not exist`
  }
  return true
}
