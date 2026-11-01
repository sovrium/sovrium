/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { resolveBrand } from './templates'

/** Every value a custom auth email template can name. */
export type SubstitutionContext = Readonly<{
  name?: string
  url?: string
  email: string
  otp?: string
  codes?: string
  organizationName?: string
  inviterName?: string
  appName?: string
}>

type VariableName = keyof SubstitutionContext

/**
 * What a variable reads as when the email type supplies no value for it. A
 * missing name reads as nothing — never an English word in a French mail.
 */
const VARIABLE_FALLBACKS: Readonly<Record<VariableName, string>> = {
  name: '',
  url: '',
  email: '',
  otp: '',
  codes: '',
  organizationName: 'the organization',
  inviterName: 'Someone',
  appName: resolveBrand(undefined),
}

/** A `$variable`, the spaces before it, and the punctuation mark right after it, if any. */
const VARIABLE_PATTERN =
  /([ \t]*)\$(name|url|email|otp|codes|organizationName|inviterName|appName)\b(?=([,.;:!?])?)/g

/**
 * ONE pass with a replacer function, for two reasons a chain of
 * `.replace(re, value)` calls gets wrong: a replacement STRING interprets
 * `$&`, `` $` `` and `$'` (so a user named `$&` duplicated template text), and a
 * later step re-scanned what an earlier one inserted (so a name containing
 * `$url` became the link). Each value is inserted exactly as it is, through
 * `encode`, and is never read again. A value that is empty right before a
 * punctuation mark takes the spaces before it along: `Hi $name,` reads `Hi,`.
 */
const substituteWith = (
  template: string,
  context: SubstitutionContext,
  encode: (value: string) => string
): string =>
  template.replace(VARIABLE_PATTERN, (_m, space: string, variable: VariableName, mark?: string) => {
    const value = context[variable] ?? VARIABLE_FALLBACKS[variable]
    return value === '' && mark !== undefined ? '' : `${space}${encode(value)}`
  })

/**
 * Substitute `$variable` references in a template string: $name, $url, $email,
 * $otp, $codes, $organizationName, $inviterName, $appName.
 */
export const substituteVariables = (template: string, context: SubstitutionContext): string =>
  substituteWith(template, context, (value) => value)

/**
 * Substitute variables into the HTML part of a template, every value
 * HTML-escaped (quotes included, so `$url` is safe inside an `href="…"`):
 * a user's, an inviter's or an organisation's name never becomes markup in
 * someone's mailbox. The subject and the text part keep the raw values.
 */
export const substituteHtmlVariables = (template: string, context: SubstitutionContext): string =>
  substituteWith(template, context, escapeHtmlAttribute)
