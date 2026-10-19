/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isLiteralName } from './document-output-validation'
import {
  validateUserAccessChange,
  validateUserAccessInput,
  type UserAccessValidationContext,
} from './tables/user-access-validation'
import type { App } from './app'

/**
 * AN ACCESS-GRANT STEP NAMES A SCOPE TABLE AND A ROLE THE APP DECLARES.
 *
 * `grantAccess`, `revokeAccess` and `listGrantees` write and read the grants
 * of one scope table, under one role. A `table` or `role` written literally is
 * known before the app starts, so it is checked then, by the same rule the
 * step applies when it runs (`user-access-validation.ts`): a table
 * `auth.scopeTables` does not list, or a role `auth.roles` does not declare, is
 * refused, naming the automation and the step. A value that arrives through a
 * template is only known when the step runs, and is left to it. At the app
 * root because it relates `automations` and `actions` to `auth`. Both places a
 * step is written are walked: every automation, and every reusable action
 * template.
 */

const GRANT_OPERATORS: ReadonlySet<string> = new Set([
  'grantAccess',
  'revokeAccess',
  'listGrantees',
])

interface GrantStep {
  readonly step: string
  readonly operator: string
  readonly props: Readonly<Record<string, unknown>>
}

/** Whether a node is an access-grant step. */
const isGrantStep = (value: Readonly<Record<string, unknown>>): boolean =>
  value['type'] === 'auth' &&
  typeof value['operator'] === 'string' &&
  GRANT_OPERATORS.has(value['operator']) &&
  isRecord(value['props'])

/** Every access-grant step anywhere under `value`. */
const grantStepsIn = (value: unknown, step: string): ReadonlyArray<GrantStep> => {
  if (Array.isArray(value)) return value.flatMap((item) => grantStepsIn(item, step))
  if (!isRecord(value)) return []
  const here = typeof value['name'] === 'string' && 'type' in value ? value['name'] : step
  const own = isGrantStep(value)
    ? [
        {
          step: here,
          operator: value['operator'] as string,
          props: value['props'] as Readonly<Record<string, unknown>>,
        },
      ]
    : []
  return [...own, ...Object.values(value).flatMap((child) => grantStepsIn(child, here))]
}

/** A prop's value when it is written literally, or `undefined` when it is a template or absent. */
const literalOf = (props: Readonly<Record<string, unknown>>, prop: string): string | undefined => {
  const value = props[prop]
  return typeof value === 'string' && isLiteralName(value.trim()) ? value.trim() : undefined
}

/** The reasons one step's literal table and role are refused. */
const refusalsOf = (found: GrantStep, context: UserAccessValidationContext): readonly string[] => {
  const table = literalOf(found.props, 'table')
  const role = literalOf(found.props, 'role')
  const tableError =
    table === undefined
      ? undefined
      : validateUserAccessInput(
          { user_id: 'checked', table_slug: table, record_ids: ['checked'] },
          context
        )
  const roleError = role === undefined ? undefined : validateUserAccessChange({ role }, context)
  return [
    ...(tableError?.field === 'table_slug' ? [`table: ${tableError.message}`] : []),
    ...(roleError === undefined ? [] : [`role: ${roleError.message}`]),
  ]
}

/** One message per access-grant step whose literal `table` or `role` the app does not declare. */
export const validateGrantActions = (app: App): readonly string[] => {
  const context: UserAccessValidationContext = {
    scopeTables: app.auth?.scopeTables ?? [],
    roleNames: app.auth?.roles?.map((role) => role.name) ?? [],
  }
  const messages = (where: string, found: GrantStep): readonly string[] =>
    refusalsOf(found, context).map((reason) => `${where}: auth.${found.operator} ${reason}`)
  return [
    ...(app.automations ?? []).flatMap((automation) =>
      grantStepsIn(automation.actions, '').flatMap((found) =>
        messages(`automation "${automation.name}", step "${found.step}"`, found)
      )
    ),
    ...(app.actions ?? []).flatMap((template) =>
      grantStepsIn(template.action, template.name).flatMap((found) =>
        messages(`action template "${template.name}", step "${found.step}"`, found)
      )
    ),
  ]
}
