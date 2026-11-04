/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Two island props of an auth form that the server resolves so the island
 * ships neither words nor a code list of its own: the form's accessible name,
 * and how each refusal that is about one field is said on that field.
 *
 * A refused password or code is the reader's typing, not the request: it reads
 * best on the field she typed it in, in the page language, rather than as the
 * auth server's own English sentence in a banner beside the form.
 */

import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import { authFormStringPrefixes } from '@/presentation/design/auth-form-types'
import type { AuthFormRenderContext } from './auth-form-action'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'

/** A refusal said on one field: the field's name, and the words. */
export interface FieldRefusal {
  readonly field: string
  readonly message: string
}

/** The methods whose password a refusal of it is about. */
const PASSWORD_METHODS: ReadonlySet<string> = new Set([
  'enableTwoFactor',
  'disableTwoFactor',
  'regenerateBackupCodes',
])

/**
 * The methods that send an authenticator code: the code step, and enrolment's
 * scan screen. A spent recovery code keeps its alert: the code step's refusal
 * of one is read there.
 */
const CODE_METHODS: ReadonlySet<string> = new Set(['verifyTwoFactor', 'enableTwoFactor'])

/** Each field refusal by the auth server's error code: the field it is about, its words' key. */
const refusalsOf = (method: string): readonly (readonly [string, string, string])[] => [
  ...(PASSWORD_METHODS.has(method)
    ? [['INVALID_PASSWORD', 'password', 'password.incorrect'] as const]
    : []),
  ...(CODE_METHODS.has(method) ? [['INVALID_CODE', 'code', 'auth.invalidCode'] as const] : []),
]

/**
 * The form's accessible name (`props['aria-label']`, in the page language) and
 * its field refusals, by error code, in the page language.
 */
export function authFormExtras(
  method: string,
  props: ElementProps,
  context: AuthFormRenderContext
): {
  readonly ariaLabel?: string
  readonly fieldRefusals?: Readonly<Record<string, FieldRefusal>>
} {
  const lang = context.lang ?? context.languages?.default ?? ''
  const label = props['aria-label']
  const refusals = refusalsOf(method)
  return {
    ...(typeof label === 'string' &&
      label !== '' && {
        ariaLabel: resolveTranslationPattern(label, lang, context.languages),
      }),
    ...(refusals.length > 0 && {
      fieldRefusals: Object.fromEntries(
        refusals.map(([code, field, key]) => [
          code,
          { field, message: resolveInterpreterString(key, lang, context.languages) },
        ])
      ),
    }),
  }
}

/**
 * The engine words an enrolment screen draws whatever the language: its one
 * sentence of guidance. Sent always, rather than only where they differ from
 * English, so the lazy form carries no English copy of them.
 */
const ALWAYS_SENT: Readonly<Record<string, readonly string[]>> = {
  enableTwoFactor: ['twoFactor.scanHint', 'twoFactor.codesHint'],
  regenerateBackupCodes: ['twoFactor.codesHint'],
}

/** The island's words in the page language: those differing from English, and the always-sent ones. */
export function authFormUiStrings(
  method: string,
  lang: string | undefined,
  languages: Languages | undefined
): Readonly<Record<string, string>> | undefined {
  const overrides = resolveInterpreterStringOverrides(
    authFormStringPrefixes(method),
    lang,
    languages
  )
  const always = (ALWAYS_SENT[method] ?? []).map(
    (key) => [key, resolveInterpreterString(key, lang ?? languages?.default, languages)] as const
  )
  return always.length === 0 ? overrides : { ...overrides, ...Object.fromEntries(always) }
}
