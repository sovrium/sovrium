/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Shared confirmation-gate vocabulary.
 *
 * Historically a component `confirm` was a single STRING — the destructive-confirm
 * prompt shown in an inline `alertdialog` whose accessible name IS that string and
 * whose confirm affordance re-uses the triggering element's own label. That string
 * form is preserved verbatim for backward compatibility.
 *
 * The OBJECT form widens the gate to the richer destructive-confirm vocabulary the
 * admin RGPD erasure (and any equivalently serious gesture) needs:
 *
 *  - a `title` SEPARATE from the body `message` (e.g. title "Confirmer l'effacement"
 *    over body "L'effacement est définitif et irréversible"), so the dialog's
 *    accessible NAME and its visible body text differ;
 *  - a `role` choice — `alertdialog` (default, the inline destructive gate) or
 *    `dialog` (a focusable, input-gated confirm such as type-to-confirm);
 *  - a type-to-confirm `input`: the confirm affordance stays DISABLED until the user
 *    types `matchValue`. `matchValue` supports the `$session.<field>` token (resolved
 *    client-side from the caller's session — e.g. `$session.email` requires the user
 *    to retype their OWN email) and `$record.<field>`;
 *  - explicit `confirmLabel` / `cancelLabel` overrides (the default confirm label
 *    re-uses the trigger label; the default cancel label is "Annuler").
 *
 * The single canonical confirm primitive (`presentation/islands/shared/inline-confirm-dialog.tsx`
 * plus the vanilla-DOM `client.ts` gate) renders BOTH forms; the button, the
 * data-table per-row action column, and the record-drawer footer action all share
 * this one vocabulary.
 *
 * @example
 * ```yaml
 * # string form (back-compat) — the prompt is the alertdialog's accessible name
 * confirm: Cette action est irréversible. Confirmer la suppression ?
 *
 * # object form — separate title, dialog role, and a type-to-confirm gate that
 * # requires the caller to retype their OWN email (composes the session binding)
 * confirm:
 *   title: Confirmer l'effacement
 *   message: L'effacement est définitif et irréversible.
 *   role: dialog
 *   input:
 *     label: Saisissez votre adresse e-mail
 *     matchValue: $session.email
 *   confirmLabel: Effacer
 *   cancelLabel: Annuler
 * ```
 */

/** The ARIA role of the confirm surface. */
export const ConfirmRoleSchema = Schema.Literals(['alertdialog', 'dialog']).annotate({
  title: 'Confirm Role',
  description:
    'ARIA role of the confirm surface: "alertdialog" (default — the inline destructive gate) or "dialog" (a focusable, input-gated confirm such as type-to-confirm).',
})

/** Type-to-confirm input descriptor: the confirm affordance is disabled until the value matches. */
export const ConfirmInputSchema = Schema.Struct({
  /** Accessible label of the type-to-confirm textbox (also its visible label). */
  label: Schema.String.annotate({
    description:
      'Accessible label of the type-to-confirm input (e.g. "Saisissez votre adresse e-mail").',
    examples: ['Saisissez votre adresse e-mail', 'Type DELETE to confirm'],
  }),
  /**
   * The confirm affordance stays DISABLED until the input value equals this. Supports
   * the `$session.<field>` token (resolved client-side from the caller's session —
   * e.g. `$session.email`) and `$record.<field>` interpolation. Omit for a free-text
   * acknowledgement input with no equality gate.
   */
  matchValue: Schema.optional(
    Schema.String.annotate({
      description:
        'The confirm affordance is disabled until the input equals this value. Supports the $session.<field> token (e.g. $session.email) and $record.<field>. Omit for a non-matching acknowledgement input.',
      examples: ['$session.email', 'DELETE', '$record.name'],
    })
  ),
}).annotate({
  title: 'Confirm Input',
  description:
    'Type-to-confirm gate: the user must type matchValue before the confirm affordance enables.',
})

/** Rich destructive-confirm descriptor (the object form of a `confirm` gate). */
export const ConfirmObjectSchema = Schema.Struct({
  /**
   * Confirmation body text (the dialog's visible message). Supports `$record.<field>`
   * and the `$session.<field>` token.
   */
  message: Schema.String.annotate({
    description:
      'Confirmation body text (the dialog message). Supports $record.<field> and $session.<field>.',
    examples: ["L'effacement est définitif et irréversible.", 'This cannot be undone.'],
  }),
  /**
   * Dialog title — the surface's accessible NAME — kept SEPARATE from the body
   * `message`. When omitted the `message` is used as the name (the legacy string
   * behavior).
   */
  title: Schema.optional(
    Schema.String.annotate({
      description:
        "Dialog title (the surface's accessible name), separate from the body message. Defaults to the message when omitted.",
      examples: ["Confirmer l'effacement", 'Delete account'],
    })
  ),
  /** ARIA role of the surface (default: alertdialog). */
  role: Schema.optional(ConfirmRoleSchema),
  /** Type-to-confirm input — the confirm affordance is disabled until it matches. */
  input: Schema.optional(ConfirmInputSchema),
  /**
   * Confirm-button label. Overrides the default (re-use the trigger's own label).
   * Supports `$t:key` translation references.
   */
  confirmLabel: Schema.optional(
    Schema.String.annotate({
      description:
        "Confirm-button label, overriding the default (re-use the trigger's label). Supports $t:key references.",
      examples: ['Effacer', 'Delete forever'],
    })
  ),
  /**
   * Cancel-button label. Overrides the interpreter default, which resolves the
   * `confirmGate.cancel` string against the app's own language ("Cancel" in
   * English, "Annuler" in French) rather than being a fixed literal. Supports
   * `$t:key`.
   */
  cancelLabel: Schema.optional(
    Schema.String.annotate({
      description:
        "Cancel-button label, overriding the language-resolved interpreter default (the `confirmGate.cancel` string — 'Cancel' in English, 'Annuler' in French). Supports $t:key.",
      examples: ['Annuler', 'Keep my account'],
    })
  ),
}).annotate({
  title: 'Confirm Object',
  description:
    'Rich destructive-confirm descriptor: a body message plus an optional separate title, dialog role, type-to-confirm input (matchValue supports $session.<field>), and confirm/cancel label overrides.',
})

/**
 * A confirmation gate before an action fires: either the legacy STRING prompt or the
 * rich OBJECT descriptor. Backward-compatible — a bare string is unchanged.
 */
export const ConfirmGateSchema = Schema.Union([Schema.String, ConfirmObjectSchema]).annotate({
  identifier: 'ConfirmGate',
  title: 'Confirm Gate',
  description:
    'Confirmation gate before an action fires. A string is the prompt (shown in an inline alertdialog whose confirm affordance re-uses the trigger label — back-compat). An object adds a separate title, dialog role, a type-to-confirm input (matchValue supports the $session.<field> token), and confirm/cancel label overrides.',
})

/** @public */
export type ConfirmRole = Schema.Schema.Type<typeof ConfirmRoleSchema>
/** @public */
export type ConfirmInput = Schema.Schema.Type<typeof ConfirmInputSchema>
/** @public */
export type ConfirmObject = Schema.Schema.Type<typeof ConfirmObjectSchema>
/** @public */
export type ConfirmGate = Schema.Schema.Type<typeof ConfirmGateSchema>
