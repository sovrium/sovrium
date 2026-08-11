/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page access cross-validation.
 *
 * Page `access` arrays may reference Sovrium groups with the `group:<name>`
 * prefix (e.g. `access: ['admin', 'group:marketing']`). Every referenced
 * group must be declared in `app.auth.groups` — an undefined group reference
 * is a configuration error.
 *
 * Extracted into a standalone module (mirroring `validateAllRoleReferences`)
 * so the `AppSchema` `Schema.filter` chain stays a thin one-liner — inlining
 * a multi-statement validator pushes TypeScript's inference depth over the
 * limit and collapses the derived `App` type to `never`.
 */

import { extractGroupNames } from './auth/groups/group-reference'

/** Minimal shape needed to validate page access group references. */
interface AppForPageAccessValidation {
  readonly auth?: { readonly groups?: ReadonlyArray<{ readonly name: string }> }
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly access?: unknown }>
}

/**
 * Validate that every `group:<name>` reference in a page `access` array
 * points to a group declared in `app.auth.groups`.
 *
 * Returns `true` when all references are valid, or an error message string
 * naming the first offending page and group.
 */
export const validateAllPageAccessGroups = (app: AppForPageAccessValidation): string | true => {
  if (!app.pages) return true

  const definedGroups = new Set(app.auth?.groups?.map((group) => group.name) ?? [])

  const error = app.pages
    .flatMap((page) =>
      extractGroupNames(page.access)
        .filter((groupName) => !definedGroups.has(groupName))
        .map(
          (groupName) =>
            `Page '${page.name}' access references undefined group 'group:${groupName}'. ` +
            `Declare it in auth.groups.`
        )
    )
    .at(0)

  return error ?? true
}
