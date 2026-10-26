/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SUBMISSION_SURFACE_PARAM } from '@/domain/models/app/forms/submission-ledger-service'
import type { Form } from '@/domain/models/app/forms'

/**
 * Build the `<form>` element attribute set.
 *
 * Comments preserved from the prior inline declaration:
 * When `lockPrefill: true`, the host page tags the form with
 * `data-inline-prefill` so the submission handler can revalidate the
 * parent record on POST. The tag also serves as the source-of-truth
 * flag for the test suite — it distinguishes inline-create submissions
 * from standalone form submits even when the locked column is also
 * present in the body. Cast is necessary because TS narrows conditional
 * spreads to optional keys (`{ 'data-embed'?: string | undefined }`)
 * which doesn't widen to Record<string, string>.
 *
 * The runtime intercepts submit and runs its own constraint-validation
 * pass via `checkValidity()` on each input, so the browser's native
 * pre-submit validation popup must be suppressed (otherwise it fires
 * BEFORE our submit listener and we never see the event). Embedded
 * forms keep native validation on — the host page may not have a
 * runtime mounted, and we still want the popup as a baseline UX.
 */
export function buildFormAttributes(
  form: Readonly<Form>,
  flags: {
    readonly embed: boolean
    readonly embedded: boolean
    readonly lockPrefill: boolean
    /** Where a private link's page posts instead: a resumed draft, an edit. */
    readonly action?: string | undefined
    /** The page's language, in an app that declares languages: a translatable answer is filed under it. */
    readonly lang?: string | undefined
  }
): Readonly<Record<string, string>> {
  const { embed, embedded, lockPrefill } = flags
  // An embed names its surface: it decides the ledger write (`storesSubmission`).
  const params = new URLSearchParams([
    ...(embedded ? [[SUBMISSION_SURFACE_PARAM, 'embed']] : []),
    ...(flags.lang === undefined ? [] : [['lang', flags.lang]]),
  ])
  const query = params.size === 0 ? '' : `?${params.toString()}`
  return {
    method: 'POST',
    action: flags.action ?? `/api/forms/${form.name}/submissions${query}`,
    'data-form-name': form.name,
    ...(embed ? { 'data-embed': 'true' } : {}),
    ...(lockPrefill ? { 'data-inline-prefill': 'locked' } : {}),
  } as Readonly<Record<string, string>>
}
