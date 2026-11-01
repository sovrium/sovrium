/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'

/** The guest form's labels and submit, and the thread's accessible name, in the page language. */
export interface GuestFormLabels {
  readonly name: string
  readonly email: string
  readonly comment: string
  readonly submit: string
  readonly section: string
  /** The refusals the inline runtime draws, each naming its field by the label above. */
  readonly refusals: {
    readonly name: string
    readonly email: string
    readonly comment: string
    readonly invalidEmail: string
  }
}

/** The `comments.*` words the SSR thread draws itself, resolved for the page language. */
export const guestFormLabelsOf = (
  currentLang: string | undefined,
  languages: Parameters<typeof resolveInterpreterString>[2]
): GuestFormLabels => {
  const word = (key: string) => resolveInterpreterString(key, currentLang, languages)
  const name = word('comments.guestName')
  const email = word('comments.guestEmail')
  const comment = word('comments.guestComment')
  const required = (label: string) => fillPlaceholders(word('form.requiredNamed'), { label })
  return {
    name,
    email,
    comment,
    submit: word('comments.submit'),
    section: word('comments.sectionLabel'),
    refusals: {
      name: required(name),
      email: required(email),
      comment: required(comment),
      invalidEmail: fillPlaceholders(word('auth.invalidEmail'), { label: email }),
    },
  }
}

/**
 * The refusals as the guest form carries them, one `data-comments-refusal-*`
 * attribute each, for the inline runtime to draw.
 */
export const guestFormRefusalAttributes = (
  labels: GuestFormLabels
): Readonly<Record<string, string>> => ({
  'data-comments-refusal-name': labels.refusals.name,
  'data-comments-refusal-email': labels.refusals.email,
  'data-comments-refusal-comment': labels.refusals.comment,
  'data-comments-refusal-invalid-email': labels.refusals.invalidEmail,
})
