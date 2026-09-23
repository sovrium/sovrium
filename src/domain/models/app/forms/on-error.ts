/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form onError — what to show when submission fails server-side.
 *
 * - `toast`: transient notification.
 * - `message`: inline message above or below the form.
 * - `errorPage`: full error page.
 */
export const FormOnErrorSchema = Schema.Struct({
  type: Schema.Literals(['toast', 'message', 'errorPage']).annotate({
    description: 'Which kind of error handler this is. It decides which of the other keys apply.',
  }),
  /** Body message to show. Supports `$t:` keys. */
  message: Schema.String.annotate({
    description: 'Text shown to the visitor when the submission is refused. Accepts a `$t:` key.',
  }),
  /** Optional title (used by `errorPage`). */
  title: Schema.optional(
    Schema.String.annotate({
      description: 'Heading shown above that text, used by the full-page form.',
    })
  ),
  /** Toast variant (only meaningful when `type: 'toast'`). */
  variant: Schema.optional(
    Schema.Literals(['error', 'warning']).annotate({
      description:
        'How severe the brief message looks; only read when the failure is shown as a toast.',
    })
  ),
}).annotate({
  identifier: 'FormOnError',
  title: 'Form onError',
  description: 'What to show when a form submission fails server-side',
})

/** @public */
export type FormOnError = Schema.Schema.Type<typeof FormOnErrorSchema>
