/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { saveForLaterOffer } from './form-save-for-later-labels'
import type { PrefillValue } from './form-field-elements'
import type { FormLinkState } from './form-prefill-resolver'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** A stored answer as an input's starting value; anything else is left out. */
const asPrefillValue = (value: unknown): PrefillValue | undefined => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value as readonly string[]
  }
  return undefined
}

/** The starting values, overlaid by the answers a resume or edit link restores. */
export function withLinkAnswers(
  starting: Readonly<Record<string, PrefillValue>> | undefined,
  link: FormLinkState | undefined
): Readonly<Record<string, PrefillValue>> | undefined {
  if (link?.answers === undefined) return starting
  const restored = Object.entries(link.answers).flatMap(([key, value]) => {
    const prefill = asPrefillValue(value)
    return prefill === undefined ? [] : [[key, prefill] as const]
  })
  return { ...starting, ...Object.fromEntries(restored) }
}

/** What a resume or edit link changes on the standalone page it opens. */
export interface FormBodyLink {
  readonly action?: string
  readonly editing?: boolean
  /** A resume link that found nothing: the page says so, never why. */
  readonly unavailable?: boolean
}

/** What a private link, and the save-for-later offer, change on a body. */
export function bodyLinkOverrides(
  form: Form,
  where: {
    readonly embed: boolean
    readonly embedded: boolean
    readonly link: FormBodyLink | undefined
    readonly lang: string | undefined
    readonly languages: App['languages']
  }
) {
  const { link } = where
  return {
    action: link?.action,
    offer: saveForLaterOffer(form, {
      standalone: !where.embed && !where.embedded,
      editing: link?.editing === true,
      lang: where.lang,
      languages: where.languages,
    }),
  }
}
