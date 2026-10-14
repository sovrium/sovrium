/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { formAddressCheck } from './form-address-validation'

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
        'Where the button navigates, required when the action is `navigate`. Accepts a `$t:` key and the same submit-time variables as a redirect URL. An `http://` or `https://` address, or a path on this site (`/thanks`, `thanks`, `?sent=1`, `#done`). Any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — is refused when the config is read.',
    }).pipe(Schema.check(formAddressCheck))
  ),
}).annotate({
  identifier: 'SuccessPageAction',
  title: 'Success Page Action',
  description:
    'One button on the success page: its label, and whether it resets the form or navigates.',
})

/**
 * A toast shown BESIDE a form's primary success effect.
 *
 * `type` names the one thing a form does once it has been sent — a success page,
 * a redirect, a reset, a toast, an inline message. A confirmation is often
 * wanted on top of that thing rather than instead of it ("Saved" as the page
 * moves on, "Added" as the form clears for the next entry), so `toast` is a
 * sibling of `type` on every variant but `type: toast`, where it would be a
 * second toast saying what the first one says. The vocabulary is the one
 * `type: toast` already uses, so a form's toast reads the same either way.
 */
export const FormSuccessToastSchema = Schema.Struct({
  message: Schema.String.annotate({
    description:
      'Text of the brief confirmation shown beside the success effect. Accepts a `$t:` key.',
  }),
  variant: Schema.optional(
    Schema.Literals(['success', 'info']).annotate({
      description: 'Which style the confirmation is given: a success tone or a neutral one.',
    })
  ),
}).annotate({
  identifier: 'FormSuccessToast',
  title: 'Form Success Toast',
  description:
    'A brief confirmation shown beside the primary success effect — before the redirect leaves, or as the form clears.',
})

/**
 * Whether the dialog, drawer or popover the form sits in closes once it has been
 * sent. Shared by every success variant.
 *
 * Unset keeps the habit a form has today: a form that writes a table record
 * closes the overlay it sits in, and one that writes none leaves it open. `true`
 * closes it in both cases, which is what a table-less form in a dialog (a
 * contact request, a feedback note) needs; `false` keeps it open in both, which
 * is what an "add another" dialog that resets needs.
 */
const FormSuccessCloseSchema = Schema.Boolean.annotate({
  description:
    'Whether the dialog, sheet or popover the form sits in closes once it has been sent. Unset: a form that writes a table record closes it, one that writes none leaves it open. true always closes it; false always leaves it open, for an add-another dialog that resets. A form in no overlay has nothing to close. true is refused beside type: successPage, which would be closed before anyone read it.',
  examples: [true, false],
})

/** The effects every success variant may add beside its own `type`. */
const formSuccessSiblingFields = {
  /** Close the overlay the form sits in. */
  close: Schema.optional(FormSuccessCloseSchema),
  /** A toast beside the primary effect. */
  toast: Schema.optional(FormSuccessToastSchema),
} as const

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
    Schema.String.annotate({
      description:
        'Where that single link button goes. An `http://` or `https://` address, or a path on this site (`/thanks`, `thanks`, `?sent=1`, `#done`). Any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — is refused when the config is read.',
    }).pipe(Schema.check(formAddressCheck))
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
  ...formSuccessSiblingFields,
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
   *     inserted row (empty when unresolved; a forms spec). Only columns the
   *     submitter supplied are interpolated — privileged / computed columns
   *     are never exposed through the redirect URL.
   *
   * Unresolved variables substitute to an empty string (never the literal
   * token).
   */
  url: Schema.String.annotate({
    description:
      'Where the visitor is sent after a successful submission. Template variables such as `$record.<column>` are replaced with the values that were submitted. An `http://` or `https://` address, or a path on this site (`/thanks`, `thanks`, `?sent=1`, `#done`). Any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — is refused when the config is read.',
  }).pipe(Schema.check(Schema.isMinLength(1)), Schema.check(formAddressCheck)),
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
  ...formSuccessSiblingFields,
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
  ...formSuccessSiblingFields,
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
  /** Close the overlay the form sits in. No `toast` here: this variant IS the toast. */
  close: formSuccessSiblingFields.close,
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
  ...formSuccessSiblingFields,
}).annotate({
  identifier: 'MessageOnSuccess',
  title: 'Inline Message (onSuccess)',
})

/**
 * Form onSuccess — discriminated union of post-submit behaviors.
 *
 * `type` is the primary effect. Beside it every variant may add `close` and —
 * except `type: toast` — a `toast`. They run in one order: the toast, then the
 * overlay closes, then the primary effect (the redirect, the reset, the page or
 * message drawn in place). Two pairings are refused by
 * {@link formOnSuccessConflict}, which `FormSchema` applies: a reset's own
 * `message` beside a `toast` (two confirmations of one reset), and `close: true`
 * beside a success page (the page would be closed before anyone read it). The
 * check cannot sit here: this union and its members carry an `identifier`, and a
 * check on an identified schema erases its published definition.
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

/**
 * The reason a form's `onSuccess` is refused, or `true` when it is not. Applied
 * by `FormSchema`; see {@link FormOnSuccessSchema} for why it does not sit on
 * the union itself.
 */
export const formOnSuccessConflict = (onSuccess: FormOnSuccess): true | string => {
  if (
    onSuccess.type === 'reset' &&
    onSuccess.message !== undefined &&
    onSuccess.toast !== undefined
  ) {
    return "onSuccess declares both a reset 'message' and a 'toast' — both confirm the same reset, so the reader would be told twice. Keep one: the reset's 'message', or the 'toast'."
  }
  if (onSuccess.type === 'successPage' && onSuccess.close === true) {
    return "onSuccess declares both 'close: true' and type 'successPage' — the success page is drawn where the form was, so closing its dialog would hide it before anyone read it. Keep one: type 'successPage' to show the page in the dialog, or 'close' with a 'toast' to close it and confirm on the page below."
  }
  return true
}

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
/** @public */
export type FormSuccessToast = Schema.Schema.Type<typeof FormSuccessToastSchema>
