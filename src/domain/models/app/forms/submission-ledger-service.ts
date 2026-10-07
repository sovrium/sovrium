/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Form } from './form'

/**
 * Where a submission was made: on the form's own route (`/forms/<name>` or its
 * custom `path`), or through a `formRef` embed on an app page.
 */
export type SubmissionSurface = 'route' | 'embed'

/**
 * The query parameter an embedded form posts its surface under
 * (`/api/forms/<name>/submissions?surface=embed`). A submission without it was
 * made on the form's own route.
 */
export const SUBMISSION_SURFACE_PARAM = 'surface'

/** The submission surface a posted query names: `embed` only when it says so. */
export function submissionSurfaceOf(value: string | undefined): SubmissionSurface {
  return value === 'embed' ? 'embed' : 'route'
}

/**
 * A submission's query split into its surface and the rest — the marker is
 * the route's, never a `$query.*` value the form reads.
 */
export function splitSubmissionSurface(query: Readonly<Record<string, string>>): {
  readonly surface: SubmissionSurface
  readonly query: Readonly<Record<string, string>>
} {
  const { [SUBMISSION_SURFACE_PARAM]: marker, ...rest } = query
  return { surface: submissionSurfaceOf(marker), query: rest }
}

/**
 * Whether a submission made on `surface` writes its row to the built-in
 * submission ledger (the console's Submissions inbox).
 *
 * `submitTo.storeSubmission` is one key read by surface: omitted, the form's
 * own route stores and an embed does not — an in-app "add a record" form is
 * not an intake to triage; `true` stores on both, `false` on neither. A form
 * capped by `availability.maxSubmissions` stores on every surface, because
 * the cap is counted by reserving that row.
 */
export function storesSubmission(
  form: Pick<Form, 'submitTo' | 'availability'>,
  surface: SubmissionSurface
): boolean {
  if (form.availability?.maxSubmissions !== undefined) return true
  const declared = form.submitTo.storeSubmission
  return declared === undefined ? surface === 'route' : declared
}
