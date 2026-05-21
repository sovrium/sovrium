/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
import { extractRolesFromPermission } from '@/domain/models/shared/permissions'

const rolesOnly = (entries: readonly string[]): readonly string[] =>
  entries.filter((entry) => !isGroupReference(entry))

const findInvalidRoleInPermissions = (
  perms: Record<string, unknown>,
  keys: readonly string[],
  validRoles: ReadonlySet<string>
): string | undefined =>
  rolesOnly(keys.flatMap((key) => extractRolesFromPermission(perms[key]))).find(
    (role) => !validRoles.has(role)
  )

const buildValidRoles = (
  auth: { readonly roles?: ReadonlyArray<{ readonly name: string }> } | undefined
): { readonly validRoles: ReadonlySet<string>; readonly validLabel: string } => {
  const customRoleNames = auth?.roles?.map((role) => role.name) ?? []
  const validRoles = new Set<string>([...BUILT_IN_ROLES, ...customRoleNames])
  const validLabel = Array.from(validRoles)
    .toSorted((a, b) => a.localeCompare(b))
    .join(', ')
  return { validRoles, validLabel }
}

const validateTableRoles = (
  tables: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>,
  validRoles: ReadonlySet<string>,
  validLabel: string
): string | undefined => {
  const keys = ['create', 'read', 'update', 'delete', 'comment'] as const
  const errors = tables
    .filter((t) => t.permissions)
    .map((t) => ({
      name: t.name,
      invalid: findInvalidRoleInPermissions(
        t.permissions as Record<string, unknown>,
        keys,
        validRoles
      ),
    }))
    .filter((r) => r.invalid)
  return errors[0]
    ? `Table '${errors[0].name}' permissions reference undefined role '${errors[0].invalid}'. Valid roles: ${validLabel}`
    : undefined
}

export const validateTableRoleReferences = (app: {
  readonly auth?: { readonly roles?: ReadonlyArray<{ readonly name: string }> }
  readonly tables?: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>
}): string | true => {
  if (!app.auth) return true
  const { validRoles, validLabel } = buildValidRoles(app.auth)
  return validateTableRoles(app.tables ?? [], validRoles, validLabel) ?? true
}

const validateBucketRoles = (
  buckets: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>,
  validRoles: ReadonlySet<string>,
  validLabel: string
): string | undefined => {
  const keys = ['upload', 'download', 'sign', 'signUpload', 'delete'] as const
  const errors = buckets
    .filter((b) => b.permissions)
    .map((b) => ({
      name: b.name,
      invalid: findInvalidRoleInPermissions(
        b.permissions as Record<string, unknown>,
        keys,
        validRoles
      ),
    }))
    .filter((r) => r.invalid)
  return errors[0]
    ? `Bucket '${errors[0].name}' permissions reference undefined role '${errors[0].invalid}'. Valid roles: ${validLabel}`
    : undefined
}

const validateTriggerRoles = (
  items: ReadonlyArray<{
    readonly name: string
    readonly permissions?: { readonly trigger?: unknown }
  }>,
  kind: string,
  validRoles: ReadonlySet<string>,
  validLabel: string
): string | undefined => {
  const errors = items
    .map((item) => ({
      name: item.name,
      invalid: rolesOnly(extractRolesFromPermission(item.permissions?.trigger)).find(
        (role) => !validRoles.has(role)
      ),
    }))
    .filter((r) => r.invalid)
  return errors[0]
    ? `${kind} '${errors[0].name}' permissions.trigger references undefined role '${errors[0].invalid}'. Valid roles: ${validLabel}`
    : undefined
}

const firstRoleError = (validators: ReadonlyArray<() => string | undefined>): string | undefined =>
  validators.map((run) => run()).find((result) => result !== undefined)

export const validateAllRoleReferences = (app: {
  readonly auth?: { readonly roles?: ReadonlyArray<{ readonly name: string }> }
  readonly tables?: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>
  readonly buckets?: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly permissions?: { readonly trigger?: unknown }
  }>
  readonly agents?: ReadonlyArray<{
    readonly name: string
    readonly permissions?: { readonly trigger?: unknown }
  }>
}): string | true => {
  if (!app.auth?.roles) return true

  const { validRoles, validLabel } = buildValidRoles(app.auth)

  const error = firstRoleError([
    () => validateTableRoles(app.tables ?? [], validRoles, validLabel),
    () => validateBucketRoles(app.buckets ?? [], validRoles, validLabel),
    () => validateTriggerRoles(app.automations ?? [], 'Automation', validRoles, validLabel),
    () => validateTriggerRoles(app.agents ?? [], 'Agent', validRoles, validLabel),
  ])

  return error ?? true
}
