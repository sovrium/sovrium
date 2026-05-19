/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { extractGroupNames } from './auth/groups/group-reference'

interface AppForPageAccessValidation {
  readonly auth?: { readonly groups?: ReadonlyArray<{ readonly name: string }> }
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly access?: unknown }>
}

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
