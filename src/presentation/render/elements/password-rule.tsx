/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The password rule a field that SETS a password states under it.
 *
 * Which field: the one whose browser autofill hint is `new-password` — the HTML
 * standard's own statement that the field sets a new password. An auth form's
 * renderer decides that hint per method (`withAuthFieldHints`); an endpoint
 * form's author declares it. A field's name never implies it.
 *
 * Which number: the app's configured minimum (`resolvePasswordPolicy`, stamped
 * on every form by `password-policy-stamp.ts`), raised by a field's own
 * `minLength` when that is larger — a field can tighten what the form stops,
 * never loosen what the server refuses.
 *
 * Worded here, on the server, in the page language (`password.minLength`), and
 * handed to the browser as a ready sentence: no policy logic and no
 * environment read reach a client bundle.
 */

import { type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { authFieldErrorId, type AuthFormField } from '@/presentation/design/auth-form-types'
import { computeFormHelpTextClasses } from '@/presentation/design/form-layout-classes'
import { stampedPasswordMinLength } from '../resolve/password-policy-stamp'
import type { Languages } from '@/domain/models/app/languages'

/** The autofill hint of a field that sets a password. */
export const NEW_PASSWORD_HINT = 'new-password'

/** An engine word by its catalogue key, in the page language. */
export function engineString(key: string, lang?: string, languages?: Languages): string {
  return resolveInterpreterString(key, lang ?? languages?.default, languages)
}

/**
 * "At least {count} characters" in the page language, `{count}` being the
 * minimum `component` was stamped with, or `fieldMinLength` when larger.
 */
export function passwordRuleText(
  component: unknown,
  lang?: string,
  languages?: Languages,
  fieldMinLength = 0
): string {
  const count = Math.max(stampedPasswordMinLength(component), fieldMinLength)
  return engineString('password.minLength', lang, languages).replace('{count}', String(count))
}

/** The auth-form fields, each one that sets a password carrying `rule`. */
export function withPasswordRule(
  fields: readonly AuthFormField[],
  rule: string
): readonly AuthFormField[] {
  return fields.map((field) =>
    field.autoComplete === NEW_PASSWORD_HINT ? { ...field, rule } : field
  )
}

/** An auth-form field's rule as the SSR skeleton draws it — the island's own markup. */
export function renderAuthFieldRule(field: AuthFormField): ReactElement | undefined {
  if (field.rule === undefined) return undefined
  return (
    <small
      id={`${authFieldErrorId(field)}-rule`}
      className={computeFormHelpTextClasses()}
    >
      {field.rule}
    </small>
  )
}
