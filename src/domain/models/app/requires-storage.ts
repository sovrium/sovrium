/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BUCKET_BOUND_FIELD_TYPES } from './buckets/field-bucket'
import type { App } from '.'

/**
 * The one standalone form input that puts a file in storage.
 *
 * A standalone field is typed inline rather than against a column
 * (`forms/fields/standalone.ts`), so an `attachment` here is a file upload with
 * no table column behind it — which is precisely why it has to be checked
 * separately from {@link BUCKET_BOUND_FIELD_TYPES}.
 */
const FILE_UPLOAD_INPUT_TYPE = 'attachment'

/**
 * Determine whether an app configuration can ever put a byte in storage.
 *
 * Pure predicate over the app schema — it never reads `STORAGE_PROVIDER`,
 * `DATABASE_URL` or any other environment variable. It answers only what the
 * app declared, so the caller can decide whether the resolved provider is worth
 * a banner row.
 *
 * The caller today is the `✓ Storage:` startup phase.
 * Naming a provider for an app that cannot store a file tells the operator
 * about a subsystem they do not use — a row that costs attention on every boot
 * and answers no question — and the `⚠ Storage: Not configured` warning is
 * worse still, since an app with no attachment surface has nothing to be warned
 * about.
 *
 * Returns `true` when ANY of the following hold:
 * - `buckets[]` is non-empty — declaring a bucket IS the statement that this
 *   app stores files;
 * - a table declares a column of a bucket-bindable attachment type;
 * - a form declares a standalone `attachment` input (a file upload with no
 *   column behind it).
 *
 * An EMPTY declaration counts as absent, matching `CAPABILITY_PREDICATES` in
 * `domain/models/app/pages/page-requires.ts`: `buckets: []` is not "this app has
 * buckets".
 */
export const appUsesStorage = (app: App): boolean => {
  if ((app.buckets ?? []).length > 0) return true

  const hasAttachmentColumn = (app.tables ?? []).some((table) =>
    table.fields.some((field) => BUCKET_BOUND_FIELD_TYPES.has(field.type))
  )
  if (hasAttachmentColumn) return true

  return (app.forms ?? []).some((form) =>
    form.fields.some(
      (field) => field.kind === 'standalone' && field.inputType === FILE_UPLOAD_INPUT_TYPE
    )
  )
}
