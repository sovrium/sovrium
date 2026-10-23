/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { formAddressCheck } from '../../forms/form-address-validation'
import { SuccessPageActionSchema } from '../../forms/on-success'
import {
  AllowOriginsSchema,
  allowOriginsNavigateConflict,
  successNavigateCheck,
} from './action-allow-origins'

/**
 * Toast notification variant
 */
export const ToastVariantSchema = Schema.Literals([
  'success',
  'error',
  'warning',
  'info',
  'loading',
]).annotate({
  title: 'Toast Variant',
  description:
    "Visual style of the toast notification. 'loading' marks a toast that says what is happening while it happens.",
})

/**
 * Toast notification configuration
 *
 * @example
 * ```yaml
 * toast:
 *   message: Record created successfully
 *   variant: success
 * ```
 */
export const ToastSchema = Schema.Struct({
  /** Message to display */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(ToastVariantSchema),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).annotate({
  title: 'Toast',
  description: 'Toast notification configuration',
})

/**
 * Action response behavior type
 *
 * Controls what happens to the form after a successful action:
 *
 * - `navigate`: Navigate to the `navigate` path (default when `navigate` is set)
 * - `reset`: Clear the form fields to their default values for rapid repeat entry.
 *   `preserveFields` may be used to retain selected field values across the reset.
 * - `message`: Show only the inline toast/message; the form keeps its values
 * - `successPage`: Replace the form with a custom success page (title, message,
 *   action buttons, optional summary of submitted values, optional redirect)
 * - `role-landing`: Navigate to the app's configured `auth.landingPath` so the
 *   existing per-role landing resolver redirects each authenticated user to
 *   their own `auth.roles[].defaultLanding`. Lets a SINGLE login form land
 *   different roles on different pages without a hardcoded `navigate` path.
 *   Only meaningful on a `type: auth`, `method: login` action and requires
 *   `auth.landingPath` (plus per-role `defaultLanding`) to be configured.
 */
export const ActionResponseTypeSchema = Schema.Literals([
  'navigate',
  'reset',
  'message',
  'successPage',
  'role-landing',
]).annotate({
  title: 'Action Response Type',
  description:
    'What the component does once the action returns — navigate away, reset the form, show a message or a success page, send the reader to their role landing, or raise a toast.',
})

/**
 * Action response handler
 *
 * Defines what happens after a successful or failed action.
 *
 * @example
 * ```yaml
 * onSuccess:
 *   navigate: /dashboard
 *   toast:
 *     message: Welcome back!
 *     variant: success
 *
 * # Quick-entry form that resets after every submission
 * onSuccess:
 *   type: reset
 *   preserveFields: [category, location]
 *   toast:
 *     message: Item added!
 *     variant: success
 *
 * # Replace the form with a custom success page after submission
 * onSuccess:
 *   type: successPage
 *   title: Thank you!
 *   message: Your response has been recorded.
 *   showSummary: true
 *   actions:
 *     - { label: Submit another, action: reset }
 *     - { label: Go home, action: navigate, url: / }
 *
 * # Single login form, per-role landing — each role lands on its own
 * # auth.roles[].defaultLanding via the engine's landingPath resolver
 * onSuccess:
 *   type: role-landing
 *   toast:
 *     message: Welcome back!
 *     variant: success
 * ```
 */
const actionResponseFields = {
  /** Behavior type — defaults to `navigate` when `navigate` is set */
  type: Schema.optional(ActionResponseTypeSchema),
  /** Path to navigate to after action */
  navigate: Schema.optional(
    Schema.String.annotate({
      description:
        'URL path to navigate to. Supports $variable references. A path on this site (`/thanks`, `thanks`, `?sent=1`, `#done`): an answered action moves the reader within the app, so on a page an `http://` or `https://` address is refused — use a link to send the reader to another site. Any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — is refused when the config is read. A lone `$response.<path>` reads the address the run returned and is checked when it is followed: an address on this site, or one on an origin `allowOrigins` lists.',
      examples: ['/dashboard', '/posts/$record.slug', '$response.output.url'],
    }).pipe(Schema.check(successNavigateCheck))
  ),
  /**
   * The other sites this action may send the reader to, when `navigate` is a
   * lone `$response.<path>` reference to the address its run returned. See
   * `action-allow-origins.ts`.
   */
  allowOrigins: Schema.optional(AllowOriginsSchema),
  /**
   * Field names whose values are retained after a `type: reset` response.
   * All other fields are cleared to their default values. Only meaningful
   * when `type` is `reset`.
   */
  preserveFields: Schema.optional(
    Schema.Array(Schema.String).annotate({
      description:
        'Field names retained after a reset. Only meaningful when type is "reset". All other fields are cleared.',
      examples: [
        ['category', 'location'],
        ['project', 'date'],
      ],
    })
  ),
  /**
   * Heading shown on the success page. Only meaningful when `type` is
   * `successPage`. Supports `$variable` references.
   */
  title: Schema.optional(
    Schema.String.annotate({
      description: 'Success page heading. Only meaningful when type is "successPage".',
      examples: ['Thank you for your feedback!', 'Ticket Created'],
    })
  ),
  /**
   * Body message shown below the heading on the success page. Only meaningful
   * when `type` is `successPage`. Supports `$variable` references.
   */
  message: Schema.optional(
    Schema.String.annotate({
      description: 'Success page body message. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * Action buttons rendered on the success page (`reset` and/or `navigate`).
   * Only meaningful when `type` is `successPage`. Shares the
   * `SuccessPageAction` shape with the standalone Forms feature.
   */
  actions: Schema.optional(
    Schema.Array(SuccessPageActionSchema).annotate({
      description: 'Success page action buttons. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * When `true`, the success page lists a read-only summary of the submitted
   * field values. Only meaningful when `type` is `successPage`.
   */
  showSummary: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Render a read-only summary of submitted values on the success page. Only meaningful when type is "successPage".',
    })
  ),
  /**
   * URL to navigate to after the success page is shown (after a short delay).
   * May interpolate `$record.id` (and other `$record.X` fields) resolved from
   * the created/updated record. Only meaningful when `type` is `successPage`.
   */
  redirect: Schema.optional(
    Schema.String.annotate({
      description:
        'URL navigated to after the success page is shown. Supports $record.X interpolation. Only meaningful when type is "successPage". A path on this site (`/thanks`, `thanks`, `?sent=1`, `#done`): on a page an `http://` or `https://` address is refused, as for navigate. Any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — is refused when the config is read.',
      examples: ['/support/tickets/$record.id'],
    }).pipe(Schema.check(formAddressCheck))
  ),
  /** Toast notification to show */
  toast: Schema.optional(ToastSchema),
  /**
   * Close the overlay the control sits in once the action succeeds — a dialog,
   * an alert dialog, a drawer, a record drawer or a popover; when two are
   * nested, only the innermost. Unset keeps each surface's own habit: a `crud`
   * form in a dialog closes it after its write, a button closes nothing.
   * `false` keeps the overlay open even after a write, for an "add another"
   * dialog that resets. A control in no overlay has nothing to close, and the
   * key does nothing there. Refused beside `type: successPage`, whose page
   * would be closed before anyone read it.
   */
  close: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Whether the dialog, sheet or popover the control sits in closes once the action succeeds; when two are nested, only the innermost closes. Unset keeps the default: a crud form in a dialog closes it after its write, a button closes nothing. false keeps it open even after a write, for an add-another dialog that resets. A control in no overlay has nothing to close. true is refused beside type: successPage, which would be closed before anyone read it.',
      examples: [true, false],
    })
  ),
} as const

/**
 * `onSuccess: { type: successPage, close: true }` — the success page is drawn
 * where the form was, so closing its overlay would hide it unread.
 */
const refuseCloseBesideSuccessPage = (response: {
  readonly close?: boolean | undefined
  readonly type?: string | undefined
  readonly navigate?: string | undefined
  readonly allowOrigins?: ReadonlyArray<string> | undefined
}): string | true =>
  allowOriginsNavigateConflict(response) !== true
    ? allowOriginsNavigateConflict(response)
    : response.close === true && response.type === 'successPage'
      ? "onSuccess declares both 'close: true' and type 'successPage' — the success page is drawn where the form was, so closing its dialog would hide it before anyone read it. Keep one: type 'successPage' to show the page in the dialog, or 'close' with a toast to close it and confirm on the page below."
      : true

export const ActionResponseSchema = Schema.Struct(actionResponseFields).pipe(
  Schema.annotate({
    title: 'Action Response',
    description:
      'Defines behavior after action success or failure. On success the effects run in one order: the toast, then the reset, then closing the overlay, then leaving the page.',
  }),
  // Piped AFTER the annotation: a trailing annotate on a checked node lands on
  // the check, and the struct's title/description would vanish from app.json.
  Schema.check(Schema.makeFilter(refuseCloseBesideSuccessPage))
)

/**
 * The components an automation button re-reads once its run succeeds, by
 * `props.id` — a grid, a list, a board or a server-rendered bound container on
 * the same page. The same re-read a `fetch` action's `onSuccess.refetch` asks
 * for, so a list the automation changed (grants added, rows archived) shows the
 * change in place instead of after a reload by hand.
 */
const AutomationSuccessRefetchSchema = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String).pipe(Schema.check(Schema.isMinLength(1))),
]).annotate({
  title: 'Automation Success Refetch',
  description:
    'props.id (or a list of them) of the components on this page to re-read once the run succeeds — a table, a list, a board, or a container bound to a data source. They re-read after the start is accepted, or after the run has ended with await: true; set await: true when the list shows what the run writes, or the re-read can come before the writes.',
  examples: ['tasks-grid', ['grants-grid', 'members-grid']],
})

/**
 * Reload the page once the run succeeds, so the server recomposes it — for an
 * automation that changes something read when the page was drawn (the chrome,
 * a value outside any re-readable region). The blunt counterpart of `refetch`.
 */
const AutomationSuccessReloadSchema = Schema.Boolean.annotate({
  title: 'Automation Success Reload',
  description:
    'When true, the page reloads once the run succeeds, so everything on it is read again — for a run that changes something no single component re-reads. Refused beside refetch, which the reload already covers, and beside close and navigate, since the reload replaces the page they act on. The toast is not shown: the reload replaces the page it would appear on.',
  examples: [true],
})

/**
 * `reload` replaces the page, so the effects that act on this page or leave it
 * cannot sit beside it: `refetch` (subsumed), `close` (nothing left to close)
 * and `navigate` (two ways of leaving).
 */
const refuseBesideReload = (response: {
  readonly reload?: boolean | undefined
  readonly refetch?: unknown
  readonly close?: boolean | undefined
  readonly navigate?: string | undefined
}): string | true => {
  if (response.reload !== true) return true
  if (response.refetch !== undefined) {
    return "onSuccess declares both 'reload' and 'refetch' — the reload re-reads the whole page, so the narrower re-read is already covered. Keep one: 'reload' when something outside any list changed, or 'refetch' to re-read the named components only."
  }
  if (response.close !== undefined) {
    return "onSuccess declares both 'reload' and 'close' — the reload replaces the page the dialog is drawn on, so there is nothing left to close. Keep one: 'reload' to redraw the page, or 'close' to close the dialog and stay on the page."
  }
  if (response.navigate !== undefined) {
    return "onSuccess declares both 'reload' and 'navigate' — both leave the page as it is drawn, and only one can happen. Keep one: 'navigate' to go to another page, or 'reload' to redraw this one."
  }
  return true
}

/**
 * The `onSuccess` of an automation action: every key of {@link ActionResponseSchema},
 * plus the two same-page refreshes a `fetch` action already offers — `refetch`
 * re-reads named components, `reload` redraws the page. An automation's own
 * `onError` (and every other action's response slot) keeps the narrower shape:
 * a failed run changed nothing to re-read.
 *
 * @example
 * ```yaml
 * action:
 *   type: automation
 *   name: grant-project-access
 *   inputData: { memberId: $record.id }
 *   await: true
 *   onSuccess:
 *     toast: { message: Access granted }
 *     refetch: grants-grid
 * ```
 */
export const AutomationSuccessResponseSchema = Schema.Struct({
  ...actionResponseFields,
  refetch: Schema.optional(AutomationSuccessRefetchSchema),
  reload: Schema.optional(AutomationSuccessReloadSchema),
}).pipe(
  Schema.annotate({
    title: 'Automation Success Response',
    description:
      'What an automation action does once its run succeeds: the effects every action response offers — a toast, closing the overlay, moving to another page — plus refetch, which re-reads named components on this page, and reload, which redraws it.',
  }),
  Schema.check(Schema.makeFilter(refuseCloseBesideSuccessPage)),
  Schema.check(Schema.makeFilter(refuseBesideReload))
)

/** @public */
export type ActionResponse = Schema.Schema.Type<typeof ActionResponseSchema>
/** @public */
export type AutomationSuccessResponse = Schema.Schema.Type<typeof AutomationSuccessResponseSchema>
/** @public */
export type ActionResponseType = Schema.Schema.Type<typeof ActionResponseTypeSchema>
/** @public */
export type Toast = Schema.Schema.Type<typeof ToastSchema>
/** @public */
export type ToastVariant = Schema.Schema.Type<typeof ToastVariantSchema>
