/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { engineString, NEW_PASSWORD_HINT, passwordRuleText } from '../password-rule'
import type { Languages } from '@/domain/models/app/languages'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

/**
 * What the server words for one password field of an endpoint form:
 *
 * - `rule`, the sentence a field that SETS a password (`autocomplete:
 *   'new-password'`) states under it, drawn as its help text;
 * - `refused`, the reason drawn on the field when a Better Auth refusal is
 *   about it — `INVALID_PASSWORD` names the `current-password` field
 *   ("The current password is incorrect"), `PASSWORD_TOO_SHORT` the
 *   `new-password` one (its rule). Only under `responseEnvelope:
 *   'better-auth'`, the one envelope whose error codes the engine speaks; the
 *   browser reads which code names which field off the hint, and the words off
 *   the control (`data-refused-message`).
 */
export interface PasswordAid {
  readonly rule?: string
  readonly refused?: string
}

/** The id of a field's rule sentence, listed in its `aria-describedby`. */
export const passwordRuleId = (field: FormFieldConfig): string => `${field.field}-rule`

/** The rule and the refusal words of one endpoint field; empty for any other field. */
export function passwordAidOf(
  field: FormFieldConfig,
  context: {
    readonly component: unknown
    readonly responseEnvelope?: string
    readonly lang?: string
    readonly languages?: Languages
  }
): PasswordAid {
  if (field.control !== 'password' || field.hidden === true) return {}
  const { component, lang, languages } = context
  const rule =
    field.autocomplete === NEW_PASSWORD_HINT
      ? passwordRuleText(component, lang, languages, field.minLength)
      : undefined
  const refused =
    field.autocomplete === 'current-password'
      ? engineString('password.incorrect', lang, languages)
      : rule
  return {
    ...(rule !== undefined && { rule }),
    ...(context.responseEnvelope === 'better-auth' && refused !== undefined && { refused }),
  }
}
