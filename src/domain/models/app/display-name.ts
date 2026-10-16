/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** Longest display name accepted: it is set in a sidebar head and a sign-in title. */
const DISPLAY_NAME_MAX_LENGTH = 100

/**
 * The name people read: `Acme CRM` where `name` says `acme-crm`.
 *
 * ─── WHY `name` CANNOT CARRY IT ────────────────────────────────────────────
 *
 * `name` is an identifier: lowercase, URL-safe, npm-shaped, and load-bearing —
 * it derives the hosted address (`deriveAppSlug`), the MCP tool prefix and the
 * analytics site key. Loosening it to accept `Café Dupont` would change all
 * three for every app that took the new freedom. The pair `name` + `displayName`
 * is the split a VS Code extension manifest makes for the same reason.
 *
 * ─── WHY THE DERIVED LABEL IS NOT ENOUGH ───────────────────────────────────
 *
 * `$app.label` already title-cases the slug (`acme-crm` → `Acme Crm`). It cannot
 * spell an acronym, an accent, an apostrophe, a brand's own casing, or a name
 * whose slug was shortened; so a console, a sign-in card and a breadcrumb had no
 * way to print what the operator calls their app.
 *
 * ─── ABSENT MEANS "AS TODAY" ───────────────────────────────────────────────
 *
 * Every surface that prints the app's name falls back to what it prints without
 * this key (see `displayNameOf`), so declaring nothing changes nothing.
 *
 * One line, not blank, no surrounding spaces, at most 100 characters.
 */
export const DisplayNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Display Name',
    description: `The name people read in the app's chrome — the operator console, the sign-in card, the page title — where \`name\` stays the identifier. One line, at most ${DISPLAY_NAME_MAX_LENGTH} characters. When absent, those surfaces print \`name\`.`,
    examples: ['Acme CRM', 'Café Dupont', "Atelier d'Anna"],
  }),
  Schema.check(
    Schema.isPattern(/^[^\r\n]*$/, {
      message: 'A display name must be a single line (line breaks are not allowed)',
    }),
    Schema.isPattern(/^\S(?:.*\S)?$/, {
      message: 'A display name must not be blank or start or end with a space',
    }),
    Schema.isMaxLength(DISPLAY_NAME_MAX_LENGTH, {
      message: `A display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less`,
    })
  )
)

/** @public */
export type DisplayName = Schema.Schema.Type<typeof DisplayNameSchema>
