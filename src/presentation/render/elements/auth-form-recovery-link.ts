/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { authFieldErrorId, type AuthFormField } from '@/presentation/design/auth-form-types'
import type { AuthFormRenderContext } from './auth-form-action'

/**
 * A sign-in form's password field with its way back in: "Forgot your
 * password?" in the page language, to the app's password-reset request page.
 * The page pass stamps that page's address (`_recoveryHref`) only on an email
 * sign-in form of an app that serves one; without it the fields come back
 * untouched.
 */
export function withRecoveryLink(
  fields: readonly AuthFormField[],
  href: string | undefined,
  context: AuthFormRenderContext
): readonly AuthFormField[] {
  if (href === undefined) return fields
  const { lang, languages } = context
  const text = resolveInterpreterString(
    'auth.forgotPassword',
    lang ?? languages?.default,
    languages
  )
  return fields.map((field) =>
    field.inputType === 'password' ? { ...field, recovery: { href, text } } : field
  )
}

/** The id of a field's control, which a label in a row of its own names by `htmlFor`. */
export const authFieldControlId = (field: AuthFormField): string =>
  `${authFieldErrorId(field)}-control`
