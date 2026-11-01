/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CODE_TOKEN_ROLES, type DesignCode } from '@/domain/models/app/design/code'

/** A colour token name that can be written into a CSS variable reference as it stands. */
const CSS_TOKEN_NAME = /^[a-zA-Z0-9_-]+$/

/**
 * The role rules of `design.code.tokens`: `span.tok-<role>` painted in the
 * colour token the role names. The value is the token's variable, so the dark
 * scheme follows its `design.darkColors` value with no rule of its own.
 *
 * The selector has to win over every other rule that paints a token span: the
 * light contrast floors (`pre.shiki:where(.github-light) .tok-XXXXXX`, 0-2-1)
 * and the dark arm (`html:is(.dark, …) pre.shiki code span.tok-dark-XXXXXX`,
 * 0-3-4). `html:is(*, .dark)` matches the root in either scheme yet weighs a
 * class, and the role class is written twice, so the rule reaches 0-4-4 in
 * BOTH schemes: it outranks them by a class rather than by source order alone,
 * and is emitted after them too. Only the roles given a colour get a rule: a
 * role left out keeps the default pair's colours, and with no `design.code`
 * there is no rule at all.
 */
export const generateRoleRules = (code: DesignCode | undefined): readonly string[] =>
  CODE_TOKEN_ROLES.flatMap((role) => {
    const token = code?.tokens?.[role]
    return token === undefined || !CSS_TOKEN_NAME.test(token)
      ? []
      : [
          `  html:is(*, .dark) pre.shiki code span.tok-${role}.tok-${role} { color: var(--color-${token}); }`,
        ]
  })
