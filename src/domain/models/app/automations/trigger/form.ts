/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../forms/name'

/**
 * Form Trigger
 *
 * Triggered by submissions to a top-level form referenced by name.
 *
 * **HARD BREAK from earlier semantics**: `form` was previously a free-form
 * string interpreted as a page path (e.g. `/contact`). It is now a kebab-case
 * `forms[].name` reference. The auxiliary `formId` disambiguator is removed
 * entirely — every form has first-class identity in `app.forms[]`.
 *
 * Cross-validation: `form` must match an existing `forms[].name`. The check
 * lives at the `AppSchema` level so the error message can name both sides of
 * the mismatch.
 */
export const FormTriggerSchema = Schema.Struct({
  type: Schema.Literal('form'),
  /** Top-level form name from app.forms[].name. Cross-validated. */
  form: FormNameSchema,
}).pipe(
  Schema.annotations({
    identifier: 'FormTrigger',
    title: 'Form Trigger',
    description:
      'Trigger automation when a top-level form is submitted. The `form` property references forms[].name (HARD BREAK: was a page path).',
  })
)

/** @public */
export type FormTrigger = Schema.Schema.Type<typeof FormTriggerSchema>
