/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Success-page action button. Each entry renders as a `<button>` on the
 * post-submit success screen and dispatches one of two predefined intents
 * (which mirror the top-level `onSuccess.type: reset` and
 * `onSuccess.type: redirect` analogs):
 *   - `action: 'reset'` returns the form to its empty initial state, ready
 *     for another submission. Equivalent to `onSuccess.type: reset`.
 *   - `action: 'navigate'` redirects the submitter to `url`. Equivalent to
 *     `onSuccess.type: redirect`. `url` is required for this variant.
 *
 * Defined as a plain Struct (rather than a discriminated union) because
 * the `url` field is only referenced when `action: 'navigate'`; downstream
 * cross-validation can warn about a stray `url` on a `reset` row without
 * blocking schema decoding.
 */
export const SuccessPageActionSchema = Schema.Struct({
  /** Button label shown on the success screen. Supports `$t:` keys. */
  label: Schema.String.annotate({
    description: 'Text printed on the button. Accepts a `$t:` key to use a translated label.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Behavior when the button is clicked. */
  action: Schema.Literals(['reset', 'navigate']).annotate({
    description:
      'What the button does: `reset` clears the form so another answer can be sent, `navigate` sends the visitor to `url`.',
  }),
  /**
   * Navigation target — required when `action: 'navigate'`.
   *
   * A `$t:` key resolves server-side against the active locale before the
   * runtime config is serialized, so a per-locale form's
   * success-screen button can navigate to a locale-specific path. After
   * locale resolution the same submit-time template variables documented on
   * `RedirectOnSuccessSchema.url` are interpolated.
   */
  url: Schema.optional(
    Schema.String.annotate({
      description:
        'Where the button navigates, required when the action is `navigate`. Accepts a `$t:` key and the same submit-time variables as a redirect URL.',
    })
  ),
}).annotate({
  identifier: 'SuccessPageAction',
  title: 'Success Page Action',
  description:
    'One button on the success page: its label, and whether it resets the form or navigates.',
})

/**
 * Success Page — show a custom success page after submission.
 */
export const SuccessPageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('successPage').annotate({
    description: 'Which kind of success handler this is. It decides which of the other keys apply.',
  }),
  /** Heading shown on the success page. Supports `$t:` keys. */
  title: Schema.optional(
    Schema.String.annotate({
      description:
        'Heading shown on the page that replaces the form once it has been sent. Accepts a `$t:` key.',
    })
  ),
  /** Body message shown below the heading. Supports `$t:` keys. */
  message: Schema.optional(
    Schema.String.annotate({
      description: 'Text shown below the heading on the success page. Accepts a `$t:` key.',
    })
  ),
  /** Optional button label that links the submitter back to the home page. */
  buttonLabel: Schema.optional(
    Schema.String.annotate({
      description: 'Text of a single link button shown on the success page.',
    })
  ),
  /** Optional URL the success page button links to. */
  buttonHref: Schema.optional(
    Schema.String.annotate({ description: 'Where that single link button goes.' })
  ),
  /**
   * Optional list of action buttons (`reset` and/or `navigate`) rendered
   * on the success screen. Useful for high-throughput flows where the
   * submitter wants to "submit another" without a full page reload.
   */
  actions: Schema.optional(
    Schema.Array(SuccessPageActionSchema).annotate({
      description:
        'Buttons offered on the success page, so the visitor can send another answer or move on without reloading.',
    })
  ),
  /**
   * Whether to render a summary of the submitted values on the success
   * screen. The renderer ignores hidden fields and applies field-level
   * read permissions before listing values.
   */
  showSummary: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Lists the submitted answers back on the success page, skipping hidden fields and any field the reader may not see.',
    })
  ),
}).annotate({
  identifier: 'SuccessPageOnSuccess',
  title: 'Success Page (onSuccess)',
})

/**
 * Redirect — navigate to another URL after submission.
 */
export const RedirectOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('redirect').annotate({
    description: 'Which kind of success handler this is. It decides which of the other keys apply.',
  }),
  /**
   * Target URL — absolute or path-relative.
   *
   * A `$t:` key resolves server-side against the active locale BEFORE the
   * runtime config is serialized, so a per-locale form can
   * redirect to a locale-specific path; locale resolution runs before any
   * path-shape check. After locale resolution the following template
   * variables are interpolated at submit time against the submission
   * response:
   *   - `$submission.id`   → ledger row id (empty when `storeSubmission: false`)
   *   - `$record.id`       → bound-table row id (empty when no `submitTo.table`)
   *   - `$record.<column>` → any submitter-provided column value of the
   * inserted row (empty when unresolved; [internal ref]). Only columns the
   *     submitter supplied are interpolated — privileged / computed columns
   *     are never exposed through the redirect URL.
   *
   * Unresolved variables substitute to an empty string (never the literal
   * token).
   */
  url: Schema.String.annotate({
    description:
      'Where the visitor is sent after a successful submission. Template variables such as `$record.<column>` are replaced with the values that were submitted.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /**
   * Delay before the navigation fires, in seconds. Default 2 — gives the
   * submitter a moment to read any flash UI rendered before the redirect.
   * `0` triggers an immediate navigation (used by tests that need a
   * deterministic post-submit URL assertion).
   */
  delaySeconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'How long to wait before the redirect fires, in seconds, so the visitor can read the confirmation first. `0` navigates immediately.',
        defaultNote: '2',
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    )
  ),
}).annotate({
  identifier: 'RedirectOnSuccess',
  title: 'Redirect (onSuccess)',
})

/**
 * Reset — clear the form for another submission.
 */
export const ResetOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('reset').annotate({
    description: 'Which kind of success handler this is. It decides which of the other keys apply.',
  }),
  /** Optional toast message shown after the reset. */
  message: Schema.optional(
    Schema.String.annotate({
      description: 'Confirmation shown briefly once the form has been cleared.',
    })
  ),
  /**
   * Field names to preserve across the reset (e.g. `email` so a returning
   * user does not retype it).
   */
  preserveFields: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One field name, left filled when the form clears' })
    ).annotate({
      description:
        'Fields to leave filled in when the form is cleared, so a returning visitor does not retype them.',
    })
  ),
}).annotate({
  identifier: 'ResetOnSuccess',
  title: 'Reset (onSuccess)',
})

/**
 * Toast — show a transient toast notification.
 */
export const ToastOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('toast').annotate({
    description: 'Which kind of success handler this is. It decides which of the other keys apply.',
  }),
  message: Schema.String.annotate({
    description: 'Text of the brief confirmation shown after submission. Accepts a `$t:` key.',
  }),
  /** Toast variant. */
  variant: Schema.optional(
    Schema.Literals(['success', 'info']).annotate({
      description: 'Which style the confirmation is given: a success tone or a neutral one.',
    })
  ),
}).annotate({
  identifier: 'ToastOnSuccess',
  title: 'Toast (onSuccess)',
})

/**
 * Inline Message — replace the form with an inline message in place.
 */
export const MessageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('message').annotate({
    description: 'Which kind of success handler this is. It decides which of the other keys apply.',
  }),
  message: Schema.String.annotate({
    description: 'Text shown in place of the form once it has been sent. Accepts a `$t:` key.',
  }),
}).annotate({
  identifier: 'MessageOnSuccess',
  title: 'Inline Message (onSuccess)',
})

/**
 * Form onSuccess — discriminated union of post-submit behaviors.
 */
export const FormOnSuccessSchema = Schema.Union([
  SuccessPageOnSuccessSchema,
  RedirectOnSuccessSchema,
  ResetOnSuccessSchema,
  ToastOnSuccessSchema,
  MessageOnSuccessSchema,
]).annotate({
  identifier: 'FormOnSuccess',
  title: 'Form onSuccess',
  description: 'Post-submit behavior. Discriminated by `type`.',
})

/** @public */
export type SuccessPageAction = Schema.Schema.Type<typeof SuccessPageActionSchema>
/** @public */
export type SuccessPageOnSuccess = Schema.Schema.Type<typeof SuccessPageOnSuccessSchema>
/** @public */
export type RedirectOnSuccess = Schema.Schema.Type<typeof RedirectOnSuccessSchema>
/** @public */
export type ResetOnSuccess = Schema.Schema.Type<typeof ResetOnSuccessSchema>
/** @public */
export type ToastOnSuccess = Schema.Schema.Type<typeof ToastOnSuccessSchema>
/** @public */
export type MessageOnSuccess = Schema.Schema.Type<typeof MessageOnSuccessSchema>
/** @public */
export type FormOnSuccess = Schema.Schema.Type<typeof FormOnSuccessSchema>
