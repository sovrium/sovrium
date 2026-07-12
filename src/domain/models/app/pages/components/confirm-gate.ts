/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const ConfirmRoleSchema = Schema.Literal('alertdialog', 'dialog').annotations({
  title: 'Confirm Role',
  description:
    'ARIA role of the confirm surface: "alertdialog" (default — the inline destructive gate) or "dialog" (a focusable, input-gated confirm such as type-to-confirm).',
})

export const ConfirmInputSchema = Schema.Struct({
  label: Schema.String.annotations({
    description:
      'Accessible label of the type-to-confirm input (e.g. "Saisissez votre adresse e-mail").',
    examples: ['Saisissez votre adresse e-mail', 'Type DELETE to confirm'],
  }),
  matchValue: Schema.optional(
    Schema.String.annotations({
      description:
        'The confirm affordance is disabled until the input equals this value. Supports the $session.<field> token (e.g. $session.email) and $record.<field>. Omit for a non-matching acknowledgement input.',
      examples: ['$session.email', 'DELETE', '$record.name'],
    })
  ),
}).annotations({
  title: 'Confirm Input',
  description:
    'Type-to-confirm gate: the user must type matchValue before the confirm affordance enables.',
})

export const ConfirmObjectSchema = Schema.Struct({
  message: Schema.String.annotations({
    description:
      'Confirmation body text (the dialog message). Supports $record.<field> and $session.<field>.',
    examples: ["L'effacement est définitif et irréversible.", 'This cannot be undone.'],
  }),
  title: Schema.optional(
    Schema.String.annotations({
      description:
        "Dialog title (the surface's accessible name), separate from the body message. Defaults to the message when omitted.",
      examples: ["Confirmer l'effacement", 'Delete account'],
    })
  ),
  role: Schema.optional(ConfirmRoleSchema),
  input: Schema.optional(ConfirmInputSchema),
  confirmLabel: Schema.optional(
    Schema.String.annotations({
      description:
        "Confirm-button label, overriding the default (re-use the trigger's label). Supports $t:key references.",
      examples: ['Effacer', 'Delete forever'],
    })
  ),
  cancelLabel: Schema.optional(
    Schema.String.annotations({
      description: 'Cancel-button label, overriding the default ("Annuler"). Supports $t:key.',
      examples: ['Annuler', 'Keep my account'],
    })
  ),
}).annotations({
  title: 'Confirm Object',
  description:
    'Rich destructive-confirm descriptor: a body message plus an optional separate title, dialog role, type-to-confirm input (matchValue supports $session.<field>), and confirm/cancel label overrides.',
})

export const ConfirmGateSchema = Schema.Union(Schema.String, ConfirmObjectSchema).annotations({
  identifier: 'ConfirmGate',
  title: 'Confirm Gate',
  description:
    'Confirmation gate before an action fires. A string is the prompt (shown in an inline alertdialog whose confirm affordance re-uses the trigger label — back-compat). An object adds a separate title, dialog role, a type-to-confirm input (matchValue supports the $session.<field> token), and confirm/cancel label overrides.',
})

export type ConfirmRole = Schema.Schema.Type<typeof ConfirmRoleSchema>
export type ConfirmInput = Schema.Schema.Type<typeof ConfirmInputSchema>
export type ConfirmObject = Schema.Schema.Type<typeof ConfirmObjectSchema>
export type ConfirmGate = Schema.Schema.Type<typeof ConfirmGateSchema>
