/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionResponseSchema } from './action-response'

/**
 * Auth action - authentication operations
 *
 * @example
 * ```yaml
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 * ```
 */
export const AuthActionSchema = Schema.Struct({
  type: Schema.Literal('auth').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Auth method */
  method: Schema.Literals([
    'login',
    'signup',
    'logout',
    'resetPassword',
    'setNewPassword',
    'verifyEmail',
  ]).annotate({
    description:
      'What the action performs: the authentication operation under `type: auth`, or the HTTP verb under `type: fetch` (default GET).',
  }),
  /** Auth strategy */
  strategy: Schema.optional(
    Schema.Literals(['email', 'magicLink', 'oauth']).annotate({
      description: 'Authentication strategy to use',
    })
  ),
  /** OAuth provider name (required when strategy is oauth) */
  provider: Schema.optional(
    Schema.String.annotate({
      description: 'OAuth provider name (e.g., google, github)',
      examples: ['google', 'github', 'discord'],
    })
  ),
  /**
   * Custom submit-button label for the embedded auth form. When omitted, the
   * renderer falls back to the localized built-in label for the `method`
   * (`Sign In` / `Sign Up` / `Send Reset Link` / `Set New Password`, resolved
   * through the page `meta.lang` + app `languages`). Supports a `$t:key`
   * translation reference. Additive/backward-compatible.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   submitLabel: Se connecter
   * ```
   */
  submitLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Submit-button label for the form this action embeds. Defaults to the localized built-in label for the method or operation. Supports $t:key translation references.',
      examples: ['Sign In', 'Se connecter', '$t:auth.submit'],
    })
  ),
  /**
   * Custom in-flight (pending) submit-button label for the embedded auth form —
   * the text shown while the request is running. When omitted, the renderer
   * falls back to the localized built-in pending label for the `method`
   * (`Signing in…` / `Creating account…` / …). Supports a `$t:key` translation
   * reference. Threaded to the shared auth-form island the same way
   * `submitLabel` is, so a localized console never shows a hardcoded
   * `Loading...`. Additive/backward-compatible.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   submitLabel: Se connecter
   *   pendingLabel: Connexion…
   * ```
   */
  pendingLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Custom in-flight (pending) submit-button label for the auth form. Defaults to the localized built-in pending label for the method. Supports $t:key translation references.',
      examples: ['Signing in…', 'Connexion…', '$t:auth.pending'],
    })
  ),
  /**
   * Per-field label/placeholder overrides for the embedded auth form. Each
   * entry targets a field by `name` (`email`, `password`, …) and overrides its
   * visible `label` and/or input `placeholder`. Fields not listed keep their
   * localized built-in label. Both `label` and `placeholder` support `$t:key`
   * translation references. Additive/backward-compatible — the default
   * email/password field set is unchanged when this is omitted.
   *
   * @example
   * ```yaml
   * action:
   *   type: auth
   *   method: login
   *   strategy: email
   *   fields:
   *     - { name: email, label: Adresse e-mail, placeholder: vous@exemple.com }
   *     - { name: password, label: Mot de passe }
   * ```
   */
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        /** Field name to target (must match a rendered auth field, e.g. `email`) */
        name: Schema.String.annotate({
          description: 'Name of the auth field to override (e.g. email, password)',
          examples: ['email', 'password'],
        }),
        /** Visible label override. Supports $t:key translation references. */
        label: Schema.optional(
          Schema.String.annotate({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Adresse e-mail', 'Mot de passe', '$t:auth.email.label'],
          })
        ),
        /** Input placeholder override. Supports $t:key translation references. */
        placeholder: Schema.optional(
          Schema.String.annotate({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['vous@exemple.com', '$t:auth.email.placeholder'],
          })
        ),
      })
    ).annotate({
      description:
        'Per-field label/placeholder overrides for the form this action embeds. Targets fields by name. Additive — the default fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Auth Action',
  description: 'Authentication action (login, signup, logout, etc.)',
})

/**
 * CRUD action - data operations
 *
 * @example
 * ```yaml
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     navigate: /posts
 *     toast:
 *       message: Post created!
 *       variant: success
 * ```
 */
export const CrudActionSchema = Schema.Struct({
  type: Schema.Literal('crud').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** CRUD operation */
  operation: Schema.Literals(['create', 'update', 'delete']).annotate({
    description: 'Data operation to perform',
  }),
  /** Target table name (must exist in app.tables) */
  table: Schema.String.annotate({
    description: 'Table to perform the operation on',
  }),
  /** Show a confirmation prompt before executing the action */
  confirm: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  /** Custom confirmation message to display (requires confirm: true) */
  confirmMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Are you sure you want to delete this record?'],
    })
  ),
  /** Static data payload for bulk update operations */
  data: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Field values to apply in bulk update operations',
      examples: [{ status: 'shipped' }, { archived: true }],
    })
  ),
  /**
   * Custom submit-button label for the embedded CRUD form. When omitted, the
   * renderer falls back to the localized built-in label for the `operation`
   * (`Create` / `Update` / `Delete`, resolved through the page `meta.lang` +
   * app `languages`). Supports a `$t:key` translation reference. Mirrors
   * `AuthActionSchema.submitLabel`. Additive/backward-compatible — existing
   * CRUD forms without this field keep the built-in label.
   *
   * @example
   * ```yaml
   * action:
   *   type: crud
   *   operation: create
   *   table: clients
   *   submitLabel: Enregistrer
   * ```
   */
  submitLabel: Schema.optional(
    Schema.String.annotate({
      description:
        'Submit-button label for the form this action embeds. Defaults to the localized built-in label for the method or operation. Supports $t:key translation references.',
      examples: ['Create', 'Enregistrer', '$t:crud.submit'],
    })
  ),
  /**
   * Per-field label/placeholder overrides for the embedded CRUD form. Each
   * entry targets a field by `name` (the table column name) and overrides its
   * visible `label` and/or input `placeholder`. Fields not listed keep their
   * table-schema-derived label. Both `label` and `placeholder` support
   * `$t:key` translation references. Mirrors `AuthActionSchema.fields`.
   * Additive/backward-compatible — the table-derived field set is unchanged
   * when this is omitted.
   *
   * @example
   * ```yaml
   * action:
   *   type: crud
   *   operation: create
   *   table: clients
   *   fields:
   *     - { name: name, label: Nom du client, placeholder: Entreprise SARL }
   *     - { name: email, label: Adresse e-mail }
   * ```
   */
  fields: Schema.optional(
    Schema.Array(
      Schema.Struct({
        /** Field name to target (must match a table column rendered in the form) */
        name: Schema.String.annotate({
          description: 'Name of the CRUD field to override (matches a table column, e.g. name)',
          examples: ['name', 'email'],
        }),
        /** Visible label override. Supports $t:key translation references. */
        label: Schema.optional(
          Schema.String.annotate({
            description: 'Visible label override for this field. Supports $t:key references.',
            examples: ['Nom du client', 'Adresse e-mail', '$t:crud.name.label'],
          })
        ),
        /** Input placeholder override. Supports $t:key translation references. */
        placeholder: Schema.optional(
          Schema.String.annotate({
            description: 'Input placeholder override for this field. Supports $t:key references.',
            examples: ['Entreprise SARL', '$t:crud.name.placeholder'],
          })
        ),
      })
    ).annotate({
      description:
        'Per-field label/placeholder overrides for the form this action embeds. Targets fields by name. Additive — the default fields are used when omitted.',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'CRUD Action',
  description: 'Data operation action (create, update, delete)',
})

/**
 * Automation action - invoke a named automation
 *
 * @example
 * ```yaml
 * action:
 *   type: automation
 *   name: generate-monthly-report
 *   inputData:
 *     month: '$currentMonth'
 *     format: pdf
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report generated!
 *       variant: success
 *     navigate: /reports
 * ```
 */
export const AutomationActionSchema = Schema.Struct({
  type: Schema.Literal('automation').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /** Automation name (must match an automation defined in app.automations) */
  name: Schema.String.annotate({
    description: 'Automation name (must match an automation defined in app.automations)',
  }),
  /** Key-value pairs passed to the automation as input */
  inputData: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'Key-value pairs passed to the automation as input. Supports $variable references.',
    })
  ),
  /** Whether to wait for completion before triggering response */
  await: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Wait for completion before triggering response (default: false = fire-and-forget)',
    })
  ),
  onSuccess: Schema.optional(ActionResponseSchema),
  onError: Schema.optional(ActionResponseSchema),
}).annotate({
  title: 'Automation Action',
  description: 'Invoke a named automation from a page component (button click, form submit)',
})

/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
/** @public */
export type CrudAction = Schema.Schema.Type<typeof CrudActionSchema>
/** @public */
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>
