/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form Save and Resume
 *
 * Lets a submitter leave a long form half-filled and come back to it. The form
 * shows a "save and continue later" action; the submitter gives an email
 * address, the answers typed so far are kept server-side under a single-use
 * token, and a resume link carrying that token is mailed to the address. Opening
 * the link reloads the form with the saved answers. The draft is deleted when
 * the form is finally submitted or when `expiresIn` has passed.
 *
 * Files picked in attachment fields are not part of a draft: they are uploaded
 * only at final submission, so a resumed form asks for them again.
 */
export const FormSaveAndResumeSchema = Schema.Struct({
  enabled: Schema.Boolean.annotate({
    description:
      'Turns on the "save and continue later" action. When true, a submitter can keep a partial answer and receive a link by email that reopens the form with what they had typed.',
  }),
  expiresIn: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: '30d',
        description:
          'How long a saved draft and its resume link stay valid, as a number followed by m (minutes), h (hours) or d (days), e.g. "72h" or "14d". After that the link no longer reopens the draft and the draft is deleted.',
      }),
      Schema.check(Schema.isPattern(/^\d+\s*(m|h|d)$/))
    )
  ),
}).annotate({
  identifier: 'FormSaveAndResume',
  title: 'Form Save and Resume',
  description:
    'Partial save of a form behind a single-use token, with a resume link sent by email.',
})

/** @public */
export type FormSaveAndResume = Schema.Schema.Type<typeof FormSaveAndResumeSchema>
