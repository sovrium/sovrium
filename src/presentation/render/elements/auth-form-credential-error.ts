/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/** What a sign-in form says when the email and password do not match, in the page language. */
export interface CredentialRefusal {
  readonly title: string
  readonly description?: string
  readonly recovery?: { readonly label: string; readonly href: string }
}

/** The refusal the page pass stamped (`_credentialError`), before its words are localized. */
export interface StampedCredentialError {
  readonly title?: unknown
  readonly description?: unknown
  readonly recovery?: { readonly label?: unknown; readonly href?: unknown }
}

/**
 * The stamped refusal with each `$t:key` resolved in the page language, ready
 * for the island; `undefined` when the form declares none, which keeps the
 * one-line banner. The stamp has already chosen the line and dropped the link
 * on an instance that cannot send mail (`auth-form-facts-stamp.ts`).
 */
export function localizeCredentialError(
  stamped: StampedCredentialError | undefined,
  { lang, languages }: { readonly lang?: string; readonly languages?: Languages }
): CredentialRefusal | undefined {
  if (stamped === undefined || typeof stamped.title !== 'string') return undefined
  const words = (text: string): string =>
    resolveTranslationPattern(text, lang ?? languages?.default ?? '', languages)
  const { description, recovery } = stamped
  const label = recovery?.label
  // The schema already holds the address to a path on this app; it is checked
  // again here, where it leaves for the island's `<a href>`, so a stamp that
  // ever carried anything else draws no link rather than an off-site one.
  const href = toSafeRedirectPath(recovery?.href)
  return {
    title: words(stamped.title),
    ...(typeof description === 'string' && { description: words(description) }),
    ...(typeof label === 'string' &&
      typeof href === 'string' && { recovery: { label: words(label), href } }),
  }
}
