/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code-block syntax roles in the exported design system: written into the
 * token document once, from `design.code.tokens`, and read back from that
 * document by every other file of the bundle (the stylesheets, the brief), so
 * no projection re-reads the config and they cannot disagree.
 *
 * Pure: no I/O.
 */

import { CODE_TOKEN_ROLES, type CodeTokenRole } from '@/domain/models/app/design/code'
import { canonicalColorName } from '@/domain/models/app/design/inherited-tokens'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system'
import type { Design } from '@/domain/models/app/design'

/** One coloured role of the document, and the colour token its alias names. */
export interface CodeRoleEntry {
  readonly role: CodeTokenRole
  readonly token: string
}

/** The DTCG alias of a token of the `color` group. */
const COLOR_ALIAS = /^\{color\.([^{}]+)\}$/

/**
 * The `code` group: one colour token per syntax role `design.code.tokens`
 * colours, its `$value` the DTCG alias of the colour token that paints it
 * (`{color.clay}`), under the name the colour group publishes it as. An alias
 * rather than a copied colour, so each mode's document resolves it against its
 * own `color` group, as the running app paints it. `undefined` when no role is
 * coloured, so such a document is exactly the one it was without the key.
 */
export const projectCodeRoles = (
  design: Design | undefined
): DesignSystemDocument['code'] | undefined => {
  const tokens = design?.code?.tokens
  const entries = CODE_TOKEN_ROLES.flatMap((role) => {
    const token = tokens?.[role]
    return token === undefined
      ? []
      : [[role, { $type: 'color' as const, $value: `{color.${canonicalColorName(token)}}` }]]
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * Every coloured role of a document, in role order, with the colour token its
 * alias names. A member whose value is not a `{color.<name>}` alias is skipped
 * rather than guessed at.
 */
export const codeRolesOf = (document: Readonly<DesignSystemDocument>): readonly CodeRoleEntry[] =>
  CODE_TOKEN_ROLES.flatMap((role) => {
    const value = document.code?.[role]?.$value
    const token = value === undefined ? undefined : COLOR_ALIAS.exec(value)?.[1]
    return token === undefined ? [] : [{ role, token }]
  })
