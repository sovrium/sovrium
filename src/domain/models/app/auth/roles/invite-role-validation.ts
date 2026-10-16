/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation `auth/inviteUser` role cross-validation.
 *
 * An `auth/inviteUser` step names the role its invitee will hold. Written
 * literally, a role the app does not know would otherwise surface only when the
 * step first runs — on the first real hire, long after deploy — so a literal
 * role outside the assignable vocabulary ({@link isAssignableRole}: the built-in
 * roles, the admin-tier names, and `auth.roles`) is refused when the app is
 * validated. A role carrying a `{{…}}` template is only known at run time, so
 * the step checks it there (it fails and creates nothing).
 *
 * Reads the automations structurally, like the group-operator rule beside it,
 * and is reached from the app-wide refinement in `app.ts` together with it.
 */

import {
  asActions,
  flattenSteps,
  propsOf,
  validateAllGroupActionReferences,
  type LooseAction,
} from '../groups/group-action-validation'
import { isAssignableRole, type AdminRoleResolvable } from './role'

/** Minimal shape needed to validate the literal roles `auth/inviteUser` steps name. */
type AppForInviteRoleValidation = AdminRoleResolvable & {
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly actions?: ReadonlyArray<unknown>
  }>
}

/** The literal role an `auth/inviteUser` step names, or `undefined` when it names none. */
const literalInviteRoleOf = (action: LooseAction): string | undefined => {
  if (action['type'] !== 'auth' || action['operator'] !== 'inviteUser') return undefined
  const { role } = propsOf(action)
  return typeof role === 'string' && !role.includes('{{') ? role.trim() : undefined
}

/**
 * Validate that every LITERAL `role` an `auth/inviteUser` step names is one the
 * app can assign.
 *
 * Returns `true` when every literal role is known, or an error naming the first
 * automation, step and role that is not.
 */
export const validateAllInviteRoleReferences = (app: AppForInviteRoleValidation): string | true => {
  const error = (app.automations ?? [])
    .flatMap((automation) =>
      flattenSteps(asActions(automation.actions)).flatMap((action) => {
        const role = literalInviteRoleOf(action)
        return role === undefined || isAssignableRole(role, app)
          ? []
          : [
              `Automation '${automation.name}' step '${String(action['name'] ?? '?')}' ` +
                `(auth/inviteUser) names unknown role '${role}'. ` +
                `Use a built-in role or declare it in auth.roles.`,
            ]
      })
    )
    .at(0)
  return error ?? true
}

/**
 * The names the `auth` automation operators write literally — groups, then the
 * invited role — checked as one declaration rule.
 */
export const validateAllAuthActionReferences = (
  app: Parameters<typeof validateAllGroupActionReferences>[0] & AppForInviteRoleValidation
): string | true => {
  const groupError = validateAllGroupActionReferences(app)
  return groupError === true ? validateAllInviteRoleReferences(app) : groupError
}
